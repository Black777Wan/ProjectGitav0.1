use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{BuildStreamError, Sample, SampleFormat, StreamConfig, SupportedStreamConfig};
use ringbuf::{HeapRb, Producer, Consumer};
use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::command;
use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, Result as SqliteResult};
use std::collections::HashMap;

// Define a struct to hold the recording state
struct RecordingState {
    // is_recording is implicit if the entry exists in ACTIVE_RECORDINGS
    start_time: Instant,
    note_id: String,
    file_path: PathBuf,
    writer: Arc<Mutex<Option<hound::WavWriter<BufWriter<File>>>>>, // Option to allow finalization
    mic_stream: Option<cpal::Stream>,
    loopback_stream: Option<cpal::Stream>,
    writer_thread: Option<JoinHandle<()>>,
    stop_signal: Arc<AtomicBool>,
}

// Define a global map to store active recordings
lazy_static::lazy_static! {
    // TODO: The cpal::Stream is !Send, so we can't directly store it in RecordingState if RecordingState needs to be Send.
    // This will require a significant refactor. For now, we'll assume we can work around this,
    // potentially by not storing the stream directly or by using a different mechanism.
    // A common approach is to send a stop signal to the audio thread that owns the stream.
    // The current placeholder for keeping streams alive via std::thread::spawn will be replaced.
    // For now, we will proceed with the stream option, and address the !Send issue if it becomes a blocker during compilation or further steps.
    // The streams will be built and played in start_recording and owned by a thread spawned there,
    // or RecordingState will need to be structured differently.
    // Let's assume for now that the streams are managed by the thread that creates them, and `RecordingState` holds join handles and signals.
    static ref ACTIVE_RECORDINGS: Mutex<HashMap<String, Arc<Mutex<RecordingState>>>> = Mutex::new(HashMap::new());
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioRecording {
    id: String,
    note_id: String,
    file_path: String,
    duration_ms: u64,
    recorded_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioBlockReference {
    id: String,
    recording_id: String,
    block_id: String,
    audio_offset_ms: u64,
}

// Start recording audio
#[command]
pub fn start_recording(note_id: &str, recording_id: &str, audio_dir: &str) -> Result<String, String> {
    let host = cpal::default_host();
    let host = cpal::default_host();
    println!("Selected host: {}", host.id().name());

    // --- Device Enumeration ---
    println!("Available input devices:");
    let mut input_devices = host.input_devices().map_err(|e| format!("Failed to enumerate input devices: {}", e))?;
    for (idx, device) in input_devices.enumerate() {
        match device.name() {
            Ok(name) => println!("  {}: {}", idx, name),
            Err(e) => println!("  {}: Error getting name: {}", idx, e),
        }
    }

    let mic_device = host.default_input_device()
        .ok_or_else(|| "No default microphone input device available".to_string())?;
    println!("Using microphone device: '{}'", mic_device.name().unwrap_or_else(|_| "Unknown".to_string()));

    let mut loopback_device: Option<cpal::Device> = None;
    if cfg!(windows) {
        println!("Attempting to find loopback device on Windows...");
        let mut devices = host.input_devices().map_err(|e| format!("Failed to enumerate input devices for loopback: {}", e))?;
        loopback_device = devices.find(|d| {
            if let Ok(name) = d.name() {
                // Common names for loopback devices on Windows. This might need to be more robust.
                name.contains("Stereo Mix") || name.contains("Wave Out Mix") || name.contains("What U Hear") || name.contains("Loopback")
            } else {
                false
            }
        });

        if let Some(ref dev) = loopback_device {
            println!("Found loopback device: '{}'", dev.name().unwrap_or_else(|_| "Unknown".to_string()));
        } else {
            println!("WARN: No loopback device found. Recording microphone only.");
        }
    } else {
        println!("INFO: Loopback device detection is currently only implemented for Windows. Recording microphone only.");
        // Future: Implement for macOS and Linux
    }

    // --- Configuration ---
    let mic_config_supported = mic_device.default_input_config()
        .map_err(|e| format!("Failed to get default mic config: {}", e))?;
    let mic_config: StreamConfig = mic_config_supported.into();
    println!("Microphone config: {:?}", mic_config);

    let mut loopback_config: Option<StreamConfig> = None;
    if let Some(ref dev) = loopback_device {
        match dev.default_input_config() {
            Ok(conf_supported) => {
                let conf: StreamConfig = conf_supported.into();
                println!("Loopback device config: {:?}", conf);
                // For simplicity, we'll try to use the mic's sample rate if possible,
                // or choose a common one. Here we just take its default.
                // More advanced logic would try to find a compatible format or resample.
                if conf.sample_rate != mic_config.sample_rate || conf.channels != mic_config.channels {
                    println!("WARN: Loopback device sample rate ({:?}) or channels ({}) differs from microphone ({:?}, {}). Mixing might be suboptimal or fail. Using loopback's default.", conf.sample_rate, conf.channels, mic_config.sample_rate, mic_config.channels);
                    // For now, we'll proceed with loopback's config if it's different.
                    // Ideally, we'd resample or pick a common supported format.
                    // Let's try to force loopback to use mic_config for now, if supported.
                    // This is a simplification.
                    let mut supported_configs = dev.supported_input_configs().map_err(|e| format!("Error getting supported configs for loopback: {}", e))?;
                    if supported_configs.any(|sc| sc.sample_format() == mic_config_supported.sample_format() && sc.sample_rate() == mic_config.sample_rate && sc.channels() == mic_config.channels) {
                        println!("Loopback device supports mic config. Using mic config for loopback.");
                        loopback_config = Some(mic_config.clone());
                    } else {
                        println!("WARN: Loopback device does not directly support mic config. Using loopback's default config. Quality may vary.");
                        loopback_config = Some(conf);
                    }
                } else {
                    loopback_config = Some(conf);
                }
            }
            Err(e) => {
                println!("WARN: Could not get default config for loopback device: {}. Disabling loopback.", e);
                loopback_device = None; // Disable loopback if config fails
            }
        }
    }

    // --- WAV File Setup ---
    let audio_dir_path = Path::new(audio_dir);
    std::fs::create_dir_all(audio_dir_path).map_err(|e| format!("Failed to create audio directory: {}", e))?;
    let file_path = audio_dir_path.join(format!("{}.wav", recording_id));

    // Determine WAV spec. If mixing, prefer stereo. Otherwise, use mic channels.
    let mut hound_channels = mic_config.channels;
    if loopback_device.is_some() && loopback_config.is_some() {
        // If mixing, output is stereo. We'll upmix/downmix individual streams if necessary in the mixing thread.
        hound_channels = 2; // Stereo for mixed output
    }

    let spec = hound::WavSpec {
        channels: hound_channels,
        sample_rate: mic_config.sample_rate.0, // Use mic's sample rate as the target for the WAV file
        bits_per_sample: 16, // Standard for WAV
        sample_format: hound::SampleFormat::Int,
    };
    
    let wav_writer = Arc::new(Mutex::new(Some(
        hound::WavWriter::create(file_path.clone(), spec)
            .map_err(|e| format!("Failed to create WAV file: {}", e))?
    )));

    // --- Ring Buffers and Stop Signal ---
    const BUFFER_SIZE: usize = 4096 * 4; // Adjust as needed, maybe based on sample rate
    let (mic_producer, mic_consumer) = HeapRb::<f32>::new(BUFFER_SIZE).split();
    let (loopback_producer, loopback_consumer) = HeapRb::<f32>::new(BUFFER_SIZE).split();
    let stop_signal = Arc::new(AtomicBool::new(false));


    // --- Stream Building ---
    let err_fn = |err: cpal::StreamError| {
        eprintln!("An error occurred on an audio stream: {}", err);
    };

    let mic_stream_stop_signal = stop_signal.clone();
    let mic_stream = build_input_stream_generic(&mic_device, &mic_config, mic_producer, mic_stream_stop_signal)
        .map_err(|e| format!("Failed to build microphone stream: {}", e))?;

    let mut actual_loopback_stream: Option<cpal::Stream> = None;
    if let (Some(dev), Some(conf)) = (loopback_device.as_ref(), loopback_config.as_ref()) {
         match build_input_stream_generic(dev, conf, loopback_producer, stop_signal.clone()) {
            Ok(stream) => {
                println!("Loopback stream built successfully.");
                actual_loopback_stream = Some(stream);
            }
            Err(e) => {
                println!("WARN: Failed to build loopback stream: {}. Recording microphone only.", e);
                // loopback_device will remain Some but actual_loopback_stream will be None
            }
        }
    }


    // --- Mixing and Writing Thread ---
    let writer_thread_stop_signal = stop_signal.clone();
    let writer_clone = wav_writer.clone();
    let target_sample_rate = mic_config.sample_rate.0; // All data converted to this SR for WAV
    let target_channels_wav = hound_channels;

    let writer_thread = thread::spawn(move || {
        // TODO: Implement proper resampling if mic_config.sample_rate and loopback_config.sample_rate differ.
        // For now, we assume data pushed to consumers is already at their respective stream's sample rate.
        // The `build_input_stream_generic` converts to f32.
        // We need to ensure data is mixed and written at `target_sample_rate`.

        let mut mic_buffer = Vec::with_capacity(BUFFER_SIZE);
        let mut loopback_buffer = Vec::with_capacity(BUFFER_SIZE);

        loop {
            if writer_thread_stop_signal.load(Ordering::Relaxed) {
                println!("Writer thread: Stop signal received.");
                break;
            }

            let mut samples_written_this_cycle = 0;

            // Read from mic consumer
            mic_buffer.clear(); // Clear previous data
            let mic_chunk = mic_consumer.pop_slice(mic_buffer.capacity());
            if mic_chunk.len() > 0 {
                 mic_buffer.extend_from_slice(mic_chunk);
            }


            if actual_loopback_stream.is_some() && loopback_config.is_some() {
                // Read from loopback consumer
                loopback_buffer.clear();
                let loopback_chunk = loopback_consumer.pop_slice(loopback_buffer.capacity());
                 if loopback_chunk.len() > 0 {
                    loopback_buffer.extend_from_slice(loopback_chunk);
                }

                // --- Mixing Logic ---
                // This is a very basic mixing strategy.
                // Assumes mic_buffer and loopback_buffer are f32 samples.
                // Writes stereo output if loopback is active.
                let mut mixed_samples_i16 = Vec::new();
                let max_len = mic_buffer.len().max(loopback_buffer.len()); // Process up to the longest available data

                for i in 0..max_len {
                    let mic_sample = *mic_buffer.get(i).unwrap_or(&0.0) * 0.7; // Scale factor for mic
                    let loopback_sample = *loopback_buffer.get(i).unwrap_or(&0.0) * 0.7; // Scale factor for loopback

                    if target_channels_wav == 2 {
                        // Stereo output: mix L/R, or use mic as L and loopback as R, or average.
                        // For simplicity, let's average them for both L and R.
                        // A more sophisticated approach might handle mono sources to stereo channels.
                        let mixed_val = (mic_sample + loopback_sample) / 2.0; // Simple average mix
                        let sample_clamped = mixed_val.max(-1.0).min(1.0); // Clamp to [-1.0, 1.0]
                        mixed_samples_i16.push((sample_clamped * std::i16::MAX as f32) as i16); // Left channel
                        mixed_samples_i16.push((sample_clamped * std::i16::MAX as f32) as i16); // Right channel
                    } else { // Mono output (only if loopback is not really active)
                        let sample_clamped = mic_sample.max(-1.0).min(1.0);
                        mixed_samples_i16.push((sample_clamped * std::i16::MAX as f32) as i16);
                    }
                }

                if !mixed_samples_i16.is_empty() {
                    if let Ok(mut guard) = writer_clone.lock() {
                        if let Some(writer) = guard.as_mut() {
                            for sample_i16 in mixed_samples_i16 {
                                writer.write_sample(sample_i16).unwrap_or_else(|e| eprintln!("Error writing mixed sample: {}",e));
                                samples_written_this_cycle +=1;
                            }
                        }
                    }
                }

            } else { // Microphone only
                if !mic_buffer.is_empty() {
                    if let Ok(mut guard) = writer_clone.lock() {
                        if let Some(writer) = guard.as_mut() {
                            for &sample_f32 in mic_buffer.iter() {
                                let sample_clamped = sample_f32.max(-1.0).min(1.0);
                                writer.write_sample((sample_clamped * std::i16::MAX as f32) as i16).unwrap_or_else(|e| eprintln!("Error writing mic sample: {}",e));
                                if target_channels_wav == 2 { // if mic is mono but wav is stereo (e.g. default)
                                     writer.write_sample((sample_clamped * std::i16::MAX as f32) as i16).unwrap_or_else(|e| eprintln!("Error writing mic sample: {}",e));
                                }
                                samples_written_this_cycle +=1;
                            }
                        }
                    }
                }
            }

            if samples_written_this_cycle == 0 && mic_consumer.is_empty() && (actual_loopback_stream.is_none() || loopback_consumer.is_empty()) {
                // No data processed and buffers are empty, sleep briefly if not stopping
                 if !writer_thread_stop_signal.load(Ordering::Relaxed) {
                    thread::sleep(Duration::from_millis(10)); // Avoid busy-waiting
                }
            }
        }
        println!("Writer thread: Finalizing WAV file.");
        if let Ok(mut guard) = writer_clone.lock() {
            if let Some(writer) = guard.take() { // Take ownership to finalize
                writer.finalize().unwrap_or_else(|e| eprintln!("Error finalizing WAV writer: {}", e));
            }
        }
        println!("Writer thread: Exiting.");
    });

    // --- Play Streams and Store State ---
    mic_stream.play().map_err(|e| format!("Failed to play mic stream: {}", e))?;
    if let Some(ref stream) = actual_loopback_stream {
        stream.play().map_err(|e| format!("Failed to play loopback stream: {}", e))?;
        println!("Both microphone and loopback streams are playing.");
    } else {
        println!("Only microphone stream is playing.");
    }
    
    let recording_state_data = RecordingState {
        start_time: Instant::now(),
        note_id: note_id.to_string(),
        file_path: file_path.clone(),
        writer: wav_writer.clone(), // The writer_thread also holds a clone
        mic_stream: Some(mic_stream), // These will be dropped when RecordingState is dropped
        loopback_stream: actual_loopback_stream,
        writer_thread: Some(writer_thread),
        stop_signal,
    };

    // ACTIVE_RECORDINGS now stores Arc<Mutex<RecordingState>>
    let mut recordings_map = ACTIVE_RECORDINGS.lock().unwrap();
    recordings_map.insert(recording_id.to_string(), Arc::new(Mutex::new(recording_state_data)));
    
    println!("Recording {} started.", recording_id);
    Ok(recording_id.to_string())
}

// Helper function to build input stream and push to a producer
fn build_input_stream_generic<T: Sample + Send + 'static>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mut producer: Producer<f32>, // Always produce f32 for easier mixing
    stop_signal: Arc<AtomicBool>,
) -> Result<cpal::Stream, BuildStreamError> {
    let err_fn = move |err| {
        eprintln!("Stream error: {}", err);
    };

    let channels = config.channels as usize;

    device.build_input_stream(
        config,
        move |data: &[T], _: &_| {
            if stop_signal.load(Ordering::Relaxed) {
                return;
            }
            // Convert to f32 and push to producer
            // This assumes interleaved data if multi-channel
            for &sample in data.iter() {
                if producer.is_full() {
                    // eprintln!("Warning: ring buffer full for device {}. Dropping samples.", device.name().unwrap_or_default());
                    break;
                }
                producer.push(sample.to_f32()).unwrap_or_else(|_| {
                    // This error means the consumer was dropped, which happens on stop.
                    // eprintln!("Failed to push to ring buffer, consumer likely dropped.");
                });
            }
        },
        err_fn,
        None, // Some(Duration::from_secs(10)) // Optional timeout
    )
}


// Stop recording audio
#[command]
pub fn stop_recording(recording_id: &str, db_conn: &Connection) -> Result<AudioRecording, String> {
    // DB interaction should happen *after* file is confirmed written and closed.

    println!("Attempting to stop recording: {}", recording_id);
    let recording_arc = {
        let mut recordings_map = ACTIVE_RECORDINGS.lock().unwrap();
        recordings_map.remove(recording_id)
            .ok_or_else(|| format!("No active recording with ID {}", recording_id))?
    };

    let (start_time, note_id_str, file_path_buf, final_writer_arc, writer_thread_handle, stop_sig, mic_s, loop_s) = {
        let mut recording_state_guard = recording_arc.lock().unwrap();

        println!("Stopping streams for recording id: {}", recording_id);
        recording_state_guard.stop_signal.store(true, Ordering::Relaxed);

        // Streams are dropped here when `recording_state_guard` releases the lock,
        // or they can be explicitly dropped.
        // Dropping them signals cpal to stop calling the data callback.
        // The producers in build_input_stream_generic will then fail to push,
        // which is fine as the stream is stopping.
        if let Some(stream) = recording_state_guard.mic_stream.take() {
            drop(stream); // Explicitly drop to ensure it happens now
            println!("Mic stream for {} taken and will be dropped.", recording_id);
        }
        if let Some(stream) = recording_state_guard.loopback_stream.take() {
            drop(stream); // Explicitly drop
            println!("Loopback stream for {} taken and will be dropped.", recording_id);
        }

        // The writer thread should see the stop_signal and/or producers being dropped, then exit.
        // We must join the writer thread to ensure all data is flushed.
        let thread_handle = recording_state_guard.writer_thread.take();

        (
            recording_state_guard.start_time,
            recording_state_guard.note_id.clone(),
            recording_state_guard.file_path.clone(),
            recording_state_guard.writer.clone(), // Clone Arc for writer, not the writer itself
            thread_handle,
            recording_state_guard.stop_signal.clone(), // Keep signal alive for thread if needed
            recording_state_guard.mic_stream.take(),
            recording_state_guard.loopback_stream.take()
        )
    };

    // Explicitly drop streams outside the lock if not already taken and dropped.
    // This is mostly to be sure, as `take()` above should have done it.
    drop(mic_s);
    drop(loop_s);

    println!("Waiting for writer thread to finish for recording id: {}", recording_id);
    if let Some(handle) = writer_thread_handle {
        match handle.join() {
            Ok(_) => println!("Writer thread for {} joined successfully.", recording_id),
            Err(e) => eprintln!("Error joining writer thread for {}: {:?}", recording_id, e),
        }
    } else {
        eprintln!("WARN: No writer thread handle found for recording id: {}. File might not be complete.", recording_id);
    }

    // Ensure the WavWriter is finalized if not done by the thread (e.g. if thread panicked)
    // The writer thread is designed to take ownership and finalize.
    // However, as a fallback, we can try to lock and finalize here if the writer Option is still Some.
    // This path should ideally not be taken if the writer thread works correctly.
    {
        let mut writer_guard = final_writer_arc.lock().unwrap();
        if let Some(writer) = writer_guard.take() {
            println!("WARN: Writer was not finalized by thread for {}. Finalizing now.", recording_id);
            writer.finalize().map_err(|e| format!("Failed to finalize WAV writer on stop: {}", e))?;
        }
    }
    
    let duration_ms = start_time.elapsed().as_millis() as u64;
    println!("Recording {} stopped. Duration: {}ms. File: {:?}", recording_id, duration_ms, file_path_buf);

    // Create the audio recording record for DB
    let recorded_at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let audio_recording = AudioRecording {
        id: recording_id.to_string(),
        note_id: note_id_str,
        file_path: file_path_buf.to_string_lossy().to_string(),
        duration_ms,
        recorded_at,
    };
    
    // Here you would re-acquire the db_conn if needed and perform the insertion.
    // Insert the recording into the database
    db_conn.execute(
        "INSERT INTO audio_recordings (id, note_id, file_path, duration_ms, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            audio_recording.id,
            audio_recording.note_id,
            audio_recording.file_path,
            audio_recording.duration_ms,
            audio_recording.recorded_at,
        ],
    ).map_err(|e| format!("Failed to insert recording into database: {}", e))?;
    
    Ok(audio_recording)
}

// Get all audio recordings for a note
#[command]
pub fn get_audio_recordings(note_id: &str, db_conn: &Connection) -> Result<Vec<AudioRecording>, String> {
    let mut stmt = db_conn.prepare(
        "SELECT id, note_id, file_path, duration_ms, recorded_at
         FROM audio_recordings
         WHERE note_id = ?1
         ORDER BY recorded_at DESC"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
    
    let recordings = stmt.query_map(params![note_id], |row| {
        Ok(AudioRecording {
            id: row.get(0)?,
            note_id: row.get(1)?,
            file_path: row.get(2)?,
            duration_ms: row.get(3)?,
            recorded_at: row.get(4)?,
        })
    }).map_err(|e| format!("Failed to query recordings: {}", e))?;
    
    let mut result = Vec::new();
    for recording in recordings {
        result.push(recording.map_err(|e| format!("Failed to read recording: {}", e))?);
    }
    
    Ok(result)
}

// Get all audio block references for a recording
#[command]
pub fn get_audio_block_references(recording_id: &str, db_conn: &Connection) -> Result<Vec<AudioBlockReference>, String> {
    let mut stmt = db_conn.prepare(
        "SELECT id, recording_id, block_id, audio_offset_ms
         FROM audio_block_references
         WHERE recording_id = ?1
         ORDER BY audio_offset_ms ASC"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
    
    let references = stmt.query_map(params![recording_id], |row| {
        Ok(AudioBlockReference {
            id: row.get(0)?,
            recording_id: row.get(1)?,
            block_id: row.get(2)?,
            audio_offset_ms: row.get(3)?,
        })
    }).map_err(|e| format!("Failed to query block references: {}", e))?;
    
    let mut result = Vec::new();
    for reference in references {
        result.push(reference.map_err(|e| format!("Failed to read block reference: {}", e))?);
    }
    
    Ok(result)
}

// Create an audio block reference
#[command]
pub fn create_audio_block_reference(
    recording_id: &str,
    block_id: &str,
    audio_offset_ms: u64,
    db_conn: &Connection
) -> Result<AudioBlockReference, String> {
    // Generate a unique ID for the reference
    let id = format!("abr_{}", chrono::Utc::now().timestamp_millis());
    
    // Create the reference object
    let reference = AudioBlockReference {
        id: id.clone(),
        recording_id: recording_id.to_string(),
        block_id: block_id.to_string(),
        audio_offset_ms,
    };
    
    // Insert the reference into the database
    db_conn.execute(
        "INSERT INTO audio_block_references (id, recording_id, block_id, audio_offset_ms)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            reference.id,
            reference.recording_id,
            reference.block_id,
            reference.audio_offset_ms,
        ],
    ).map_err(|e| format!("Failed to insert block reference into database: {}", e))?;
    
    Ok(reference)
}

