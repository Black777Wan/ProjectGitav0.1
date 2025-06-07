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
    writer: Arc<Mutex<Option<hound::WavWriter<BufWriter<File>>>>>,
    mic_stream: Option<cpal::Stream>, // These are !Send, managed by their thread.
    loopback_stream: Option<cpal::Stream>, // These are !Send, managed by their thread.
    writer_thread: Option<JoinHandle<()>>,
    stop_signal: Arc<AtomicBool>,
    mic_device_identifier: String, // Name or other unique ID
    loopback_device_identifier: Option<String>, // Name or other unique ID
}

lazy_static::lazy_static! {
    static ref ACTIVE_RECORDINGS: Mutex<HashMap<String, Arc<Mutex<RecordingState>>>> = Mutex::new(HashMap::new());
    // Global host, initialized on first use. Keep it alive for callbacks.
    static ref GLOBAL_HOST: Mutex<Option<cpal::Host>> = Mutex::new(None);
    // Ensures devices_changed_callback is registered only once.
    static ref DEVICE_CHANGE_LISTENER_REGISTERED: AtomicBool = AtomicBool::new(false);
}


// This callback function will be invoked by CPAL when audio devices change.
// It needs to be `Send + 'static` if it's registered globally.
// To interact with ACTIVE_RECORDINGS, it must be carefully designed.
fn devices_changed_callback(host_id: cpal::HostId) {
    println!("Audio devices changed for host: {:?}", host_id);

    // Create a snapshot of recording identifiers to check.
    // This avoids holding the ACTIVE_RECORDINGS lock for too long.
    let recordings_to_check: Vec<(String, String, Option<String>)> = {
        let active_recordings_guard = ACTIVE_RECORDINGS.lock().unwrap();
        active_recordings_guard.iter().filter_map(|(id, state_arc)| {
            let state_guard = state_arc.lock().unwrap(); // Lock individual state
            Some((
                id.clone(),
                state_guard.mic_device_identifier.clone(),
                state_guard.loopback_device_identifier.clone(),
            ))
        }).collect()
    };

    if recordings_to_check.is_empty() {
        println!("Device change detected, but no active recordings to check.");
        return;
    }

    // Get the current list of available devices from the global host.
    // This requires locking GLOBAL_HOST.
    let host_opt = { // Scope for host_guard
        let mut host_guard = GLOBAL_HOST.lock().unwrap();
        if host_guard.is_none() {
            // Attempt to initialize if not already. Should ideally be initialized before callback is registered.
            println!("WARN: GLOBAL_HOST not initialized during devices_changed_callback. Attempting to initialize.");
            *host_guard = Some(cpal::default_host());
        }
        host_guard.clone() // Clone the Option<Host>, not the MutexGuard
    };

    let host = match host_opt {
        Some(h) => h,
        None => {
            eprintln!("ERROR: GLOBAL_HOST could not be initialized in devices_changed_callback. Cannot check devices.");
            return;
        }
    };

    let current_devices = match host.input_devices() {
        Ok(devices) => devices.collect::<Vec<_>>(),
        Err(e) => {
            eprintln!("Error fetching current input devices in callback: {}", e);
            return;
        }
    };

    let current_device_names: Vec<String> = current_devices.iter().filter_map(|d| d.name().ok()).collect();
    println!("Current available input device names: {:?}", current_device_names);

    for (rec_id, mic_id, loop_id_opt) in recordings_to_check {
        let mut mic_found = false;
        for name in &current_device_names {
            if *name == mic_id {
                mic_found = true;
                break;
            }
        }

        let mut loopback_found_or_not_used = true; // Assume true if not used
        if let Some(loop_id) = loop_id_opt {
            loopback_found_or_not_used = false; // Now it must be found
            for name in &current_device_names {
                if *name == loop_id {
                    loopback_found_or_not_used = true;
                    break;
                }
            }
        }

        if !mic_found || !loopback_found_or_not_used {
            println!(
                "Device change: Mic found: {}, Loopback found/not used: {} for recording ID: {}",
                mic_found, loopback_found_or_not_used, rec_id
            );
            // Device used by this recording is missing. Signal it to stop.
            let active_recordings_guard = ACTIVE_RECORDINGS.lock().unwrap();
            if let Some(state_arc) = active_recordings_guard.get(&rec_id) {
                let mut state_guard = state_arc.lock().unwrap();
                if !state_guard.stop_signal.load(Ordering::Relaxed) {
                    state_guard.stop_signal.store(true, Ordering::Relaxed);
                    println!("Recording {} stopped due to audio device removal/change.", rec_id);
                }
            }
        }
    }
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
    // --- Host Initialization and Device Change Listener Registration ---
    let host = {
        let mut host_guard = GLOBAL_HOST.lock().unwrap();
        if host_guard.is_none() {
            println!("Initializing global CPAL host.");
            *host_guard = Some(cpal::default_host());
        }
        host_guard.as_ref().unwrap().clone() // Clone the host for use in this function
    };

    // Register device change callback if not already done.
    // This is specific to Windows for now as per subtask requirements.
    if cfg!(windows) && !DEVICE_CHANGE_LISTENER_REGISTERED.load(Ordering::Relaxed) {
        // The callback registration requires the host to live as long as the callback might be called.
        // Using a global host stored in lazy_static helps with this.
        // The callback itself must be Send + 'static.
        // Note: cpal documentation implies that the callback is called on a special system thread.
        // We must be careful with locking and long operations inside the callback.
        match host.devices_changed_event_stream() {
            Ok(stream) => {
                 // Keep the stream alive. If it's dropped, events are no longer delivered.
                 // This needs a more robust way to keep it alive for the duration of the app.
                 // For now, let's leak it. This is not ideal for production.
                 // A better approach might involve a dedicated thread that owns the stream
                 // and uses channels to communicate with the rest of the app, or manage its lifetime
                 // with the application lifecycle.
                 // Given the current structure, direct registration with a 'static callback is simpler.
                // The host itself is 'static due to lazy_static.
                // The callback registration is tricky with lifetimes if host is not 'static.
                // Let's assume the host obtained from GLOBAL_HOST is effectively 'static for this.
                // This part of cpal's API might need careful handling of lifetimes or specific patterns.
                // For now, we rely on the 'static nature of the GLOBAL_HOST's content.
                // The callback `devices_changed_callback` is defined globally.
                // Cpal's `run_event_loop_on_display_serial` or similar might be relevant for some platforms
                // but `devices_changed_event_stream` seems more direct for this.
                // The core issue is ensuring the Host outlives the callback registration.
                // By storing Host in a static Mutex, it should.
                // The event stream must be consumed or it might block/stop.
                // Spawning a thread to consume it:
                std::thread::spawn(move || {
                    let event_stream = host.devices_changed_event_stream().unwrap(); // Re-create stream for this thread
                    println!("Device event stream listener thread started.");
                    for event in event_stream {
                        match event {
                            Ok(cpal::DevicesChangedEvent::DevicesChanged) => {
                                devices_changed_callback(host.id());
                            }
                            Err(e) => {
                                eprintln!("Error in device event stream: {}", e);
                            }
                        }
                    }
                    println!("Device event stream listener thread finished.");
                });

                DEVICE_CHANGE_LISTENER_REGISTERED.store(true, Ordering::Relaxed);
                println!("Device change listener registered.");
            }
            Err(e) => {
                eprintln!("Failed to get device changed event stream: {}. Device change detection will not work.", e);
                // Proceed without device change detection if stream fails.
            }
        }
    }


    // --- Device Enumeration (using the already acquired host instance) ---
    println!("Selected host: {}", host.id().name());
    println!("Probing for available input devices...");
    let mut available_input_devices = Vec::new();
    match host.input_devices() {
        Ok(devices) => {
            for (idx, device) in devices.enumerate() {
                match device.name() {
                    Ok(name) => {
                        let mut log_line = format!("  Input Device {}: \"{}\"", idx, name);
                        // Attempt to get default input config for more details
                        if let Ok(config) = device.default_input_config() {
                            log_line.push_str(&format!(" (Default config: {} channels, {} Hz, {:?})", config.channels(), config.sample_rate().0, config.sample_format()));
                        }
                        println!("{}", log_line);
                        available_input_devices.push(device.clone()); // Clone device for further processing if needed

                        // Platform-specific keyword checks for potential loopback devices (logging only)
                        if cfg!(target_os = "macos") {
                            let macos_keywords = ["BlackHole", "Soundflower", "Loopback Audio", "Aggregate Device", "Multi-Output Device"];
                            for keyword in &macos_keywords {
                                if name.to_lowercase().contains(&keyword.to_lowercase()) {
                                    println!("    (Potential macOS loopback candidate by keyword '{}')", keyword);
                                    break;
                                }
                            }
                        } else if cfg!(target_os = "linux") {
                            let linux_keywords = ["Monitor of", "Loopback"]; // PulseAudio/PipeWire often use "Monitor of..."
                            for keyword in &linux_keywords {
                                if name.contains(keyword) { // Case-sensitive might be better for "Monitor of"
                                    println!("    (Potential Linux loopback candidate by keyword '{}')", keyword);
                                    break;
                                }
                            }
                        }
                    }
                    Err(e) => println!("  Input Device {}: Error getting name: {}", idx, e),
                }
            }
        }
        Err(e) => {
            return Err(format!("Failed to enumerate input devices: {}", e));
        }
    }

    if available_input_devices.is_empty() {
        return Err("No input devices found.".to_string());
    }

    let mic_device = host.default_input_device()
        .ok_or_else(|| "No default microphone input device available".to_string())?;
    let mic_device_identifier = mic_device.name().map_err(|e| format!("Failed to get mic device name: {}", e))?;
    println!("Default microphone device selected: '{}'", mic_device_identifier);
    if let Ok(config) = mic_device.default_input_config() {
        println!("  Default mic config: {} channels, {} Hz, {:?}", config.channels(), config.sample_rate().0, config.sample_format());
    }


    let mut loopback_device: Option<cpal::Device> = None;
    let mut loopback_device_identifier: Option<String> = None;

    if cfg!(windows) {
        println!("Attempting to find specific loopback device on Windows...");
        // Iterate through the already fetched `available_input_devices` for Windows loopback
        for device_candidate in available_input_devices.iter() {
            if let Ok(name) = device_candidate.name() {
                if name.contains("Stereo Mix") || name.contains("Wave Out Mix") || name.contains("What U Hear") || name.contains("Loopback") {
                    loopback_device = Some(device_candidate.clone());
                    loopback_device_identifier = Some(name);
                    break;
                }
            }
        }
        if let Some(ref id) = loopback_device_identifier {
            println!("Windows loopback device found and selected: '{}'", id);
        } else {
            println!("WARN: No specific Windows loopback device (Stereo Mix, etc.) found. Will record microphone only unless a generic loopback was logged above.");
        }
    } else if cfg!(target_os = "macos") {
        println!("INFO: Automatic loopback device selection is not implemented for macOS. Logged candidates above might be manually selectable in the future.");
    } else if cfg!(target_os = "linux") {
        println!("INFO: Automatic loopback device selection is not implemented for Linux. Logged candidates above might be manually selectable in the future.");
    } else {
        println!("INFO: Loopback device detection is OS-specific. Microphone only for this platform unless a generic input device serves as loopback.");
    }

    // --- Configuration ---
    const TARGET_SAMPLE_RATE: u32 = 48000;
    let target_sample_format = SampleFormat::F32; // Process as f32, convert to i16 for WAV

    // Configure Microphone
    let mut mic_config = mic_device.default_input_config()
        .map_err(|e| format!("Failed to get default mic config: {}", e))?
        .with_sample_rate(cpal::SampleRate(TARGET_SAMPLE_RATE));
    if !mic_device.supported_input_configs().map_err(|e| format!("Failed to get supported mic configs: {}", e))?.any(|c| c.sample_rate() == cpal::SampleRate(TARGET_SAMPLE_RATE) && c.channels() <= 2 && c.sample_format() == target_sample_format) {
        println!("WARN: Microphone does not support {} Hz sample rate with f32 format. Using default.", TARGET_SAMPLE_RATE);
        mic_config = mic_device.default_input_config().map_err(|e| format!("Failed to get default mic config: {}", e))?;
    }
    // Try to set to stereo, fall back to mono
    let supported_mic_channels = mic_config.channels();
    if mic_device.supported_input_configs().map_err(|e| format!("Failed to get supported mic configs: {}", e))?.any(|c| c.sample_rate() == mic_config.sample_rate() && c.channels() == 2 && c.sample_format() == target_sample_format) {
        mic_config.config().channels = 2;
        println!("Microphone configured for stereo input at {:?}.", mic_config.sample_rate());
    } else if mic_device.supported_input_configs().map_err(|e| format!("Failed to get supported mic configs: {}", e))?.any(|c| c.sample_rate() == mic_config.sample_rate() && c.channels() == 1 && c.sample_format() == target_sample_format) {
        mic_config.config().channels = 1;
        println!("Microphone configured for mono input at {:?}. Will be upmixed to stereo.", mic_config.sample_rate());
    } else {
        println!("WARN: Microphone does not support stereo or mono at {:?}. Using default channels: {}.", mic_config.sample_rate(), supported_mic_channels);
        mic_config.config().channels = supported_mic_channels; // Keep original channels if specific fallbacks fail
    }
    let final_mic_config: StreamConfig = mic_config.into();
    let mic_actual_channels = final_mic_config.channels;
    println!("[AudioProcessing] Final Microphone config: Channels: {}, Rate: {}Hz, Format: {:?}", final_mic_config.channels, final_mic_config.sample_rate.0, final_mic_config.sample_format);
    if final_mic_config.sample_rate.0 != TARGET_SAMPLE_RATE {
        println!("[AudioProcessing] WARN: Mic stream sample rate {} Hz differs from target WAV rate {} Hz.", final_mic_config.sample_rate.0, TARGET_SAMPLE_RATE);
    }

    // Configure Loopback
    let mut loopback_config_final: Option<StreamConfig> = None;
    let mut loopback_actual_channels: Option<u16> = None;
    let final_loopback_device_identifier = loopback_device_identifier.clone();

    if let Some(ref dev) = loopback_device {
        let mut loop_conf_supported = dev.default_input_config()
            .map_err(|e| format!("Failed to get default loopback config: {}", e))?
            .with_sample_rate(cpal::SampleRate(TARGET_SAMPLE_RATE));

        if !dev.supported_input_configs().map_err(|e| format!("Failed to get supported loopback configs: {}", e))?.any(|c| c.sample_rate() == cpal::SampleRate(TARGET_SAMPLE_RATE) && c.channels() <= 2 && c.sample_format() == target_sample_format) {
            println!("[AudioProcessing] WARN: Loopback device does not support {} Hz sample rate with f32 format. Using default.", TARGET_SAMPLE_RATE);
            loop_conf_supported = dev.default_input_config().map_err(|e| format!("Failed to get default loopback config: {}", e))?;
        }

        let supported_loop_channels = loop_conf_supported.channels();
        if dev.supported_input_configs().map_err(|e| format!("Failed to get supported loopback configs: {}", e))?.any(|c| c.sample_rate() == loop_conf_supported.sample_rate() && c.channels() == 2 && c.sample_format() == target_sample_format) {
            loop_conf_supported.config().channels = 2;
            println!("[AudioProcessing] Loopback device configured for stereo input at {:?}.", loop_conf_supported.sample_rate());
        } else if dev.supported_input_configs().map_err(|e| format!("Failed to get supported loopback configs: {}", e))?.any(|c| c.sample_rate() == loop_conf_supported.sample_rate() && c.channels() == 1 && c.sample_format() == target_sample_format) {
            loop_conf_supported.config().channels = 1;
            println!("[AudioProcessing] Loopback device configured for mono input at {:?}. Will be upmixed to stereo.", loop_conf_supported.sample_rate());
        } else {
             println!("[AudioProcessing] WARN: Loopback device does not support stereo or mono at {:?}. Using default channels: {}.", loop_conf_supported.sample_rate(), supported_loop_channels);
            loop_conf_supported.config().channels = supported_loop_channels;
        }
        let final_loop_conf: StreamConfig = loop_conf_supported.into();
        loopback_actual_channels = Some(final_loop_conf.channels);
        loopback_config_final = Some(final_loop_conf);
        println!("[AudioProcessing] Final Loopback config: Channels: {}, Rate: {}Hz, Format: {:?}", final_loop_conf.channels, final_loop_conf.sample_rate.0, final_loop_conf.sample_format);
        if final_loop_conf.sample_rate.0 != TARGET_SAMPLE_RATE {
            println!("[AudioProcessing] WARN: Loopback stream sample rate {} Hz differs from target WAV rate {} Hz.", final_loop_conf.sample_rate.0, TARGET_SAMPLE_RATE);
        }
    } else {
        loopback_actual_channels = None;
    }

    println!("[AudioProcessing] Mic stream determined channels for writer thread: {}", mic_actual_channels);
    if let Some(ch) = loopback_actual_channels {
        println!("[AudioProcessing] Loopback stream determined channels for writer thread: {}", ch);
    } else {
        println!("[AudioProcessing] Loopback stream not active or not configured for writer thread.");
    }

    // --- WAV File Setup ---
    let audio_dir_path = Path::new(audio_dir);
    std::fs::create_dir_all(audio_dir_path).map_err(|e| format!("Failed to create audio directory: {}", e))?;
    let file_path = audio_dir_path.join(format!("{}.wav", recording_id));

    let spec = hound::WavSpec {
        channels: 2, // Always stereo output
        sample_rate: TARGET_SAMPLE_RATE,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    println!("[AudioProcessing] WAV Spec for output file: Channels: {}, Sample Rate: {} Hz, Bits/Sample: {}, Format: {:?}", spec.channels, spec.sample_rate, spec.bits_per_sample, spec.sample_format);
    
    let wav_writer = Arc::new(Mutex::new(Some(
        hound::WavWriter::create(file_path.clone(), spec)
            .map_err(|e| format!("Failed to create WAV file: {}", e))?
    )));

    // --- Ring Buffers and Stop Signal ---
    // Buffer size should be generous enough, e.g., for a few hundred ms of audio at 48kHz stereo.
    // 48000 samples/sec * 2 channels * 4 bytes/sample (f32) * 0.2 sec = 76800 bytes.
    // Ringbuf stores number of items, not bytes. So, for 200ms of stereo f32: 48000 * 0.2 * 2 = 19200 samples.
    // Or for mono: 48000 * 0.2 = 9600 samples.
    // Let's use a slightly larger buffer, e.g. 32768, which can hold ~0.34s of stereo data or ~0.68s of mono.
    const RING_BUFFER_CAPACITY: usize = 32768;
    let (mic_producer, mut mic_consumer) = HeapRb::<f32>::new(RING_BUFFER_CAPACITY).split();
    let (loopback_producer, mut loopback_consumer) = HeapRb::<f32>::new(RING_BUFFER_CAPACITY).split();
    let stop_signal = Arc::new(AtomicBool::new(false));

    // --- Stream Building ---
    let err_fn = |err: cpal::StreamError| {
        eprintln!("An error occurred on an audio stream: {}", err);
    };

    let mic_stream_stop_signal = stop_signal.clone();
    let mic_device_name_log = mic_device.name().unwrap_or_else(|_| "Unknown Mic".to_string());
    let mic_stream = build_input_stream_generic(&mic_device, &final_mic_config, mic_producer, mic_stream_stop_signal, mic_device_name_log.clone())
        .map_err(|e| format!("Failed to build microphone stream: {}", e))?;
    println!("[AudioProcessing] Microphone stream built for device: '{}'", mic_device_name_log);

    let mut actual_loopback_stream: Option<cpal::Stream> = None;
    if let (Some(dev), Some(conf)) = (loopback_device.as_ref(), loopback_config_final.as_ref()) {
        let loopback_device_name_log = dev.name().unwrap_or_else(|_| "Unknown Loopback".to_string());
        match build_input_stream_generic(dev, conf, loopback_producer, stop_signal.clone(), loopback_device_name_log.clone()) {
            Ok(stream) => {
                println!("[AudioProcessing] Loopback stream built successfully for device: '{}'", loopback_device_name_log);
                actual_loopback_stream = Some(stream);
            }
            Err(e) => {
                println!("[AudioProcessing] WARN: Failed to build loopback stream for device '{}': {}. Recording microphone only.", loopback_device_name_log, e);
                loopback_actual_channels = None;
                // loopback_device_identifier should remain Some if device was found but stream failed,
                // but actual_loopback_stream being None is key for writer thread.
                // For consistency in RecordingState, perhaps clear loopback_device_identifier if stream fails?
                // final_loopback_device_identifier = None; // Decided against this to keep original device name for potential debugging.
            }
        }
    } else {
        loopback_actual_channels = None; // loopback_device_identifier is already None
    }


    // --- Mixing and Writing Thread ---
    let writer_thread_stop_signal = stop_signal.clone();
    let writer_clone = wav_writer.clone();
    // Removed target_sample_rate and target_channels_wav, using const TARGET_SAMPLE_RATE and fixed 2 channels for WAV.

    let writer_thread = thread::spawn(move || {
        let mut iteration_count: u64 = 0; // For logging initial samples and periodic updates
        const LOG_INITIAL_SAMPLES_COUNT: u64 = 5; // Log first N iterations with pre-mix values
        const LOG_CHUNK_THRESHOLD: usize = 2000; // Log if more than this many i16 samples are written
        const PERIODIC_LOG_INTERVAL: u64 = 100; // Log summary every N iterations after initial phase

        println!("[AudioProcessing] Writer thread started. Mic source channels: {}. Loopback active: {}, Loopback source channels: {:?}",
            mic_actual_channels,
            actual_loopback_stream.is_some() && loopback_actual_channels.is_some(),
            loopback_actual_channels.map_or_else(|| "N/A".to_string(), |ch| ch.to_string()));

        let mut mic_samples_f32 = Vec::with_capacity(RING_BUFFER_CAPACITY);
        let mut loopback_samples_f32 = Vec::with_capacity(RING_BUFFER_CAPACITY);
        let mut mixed_samples_i16 = Vec::with_capacity(RING_BUFFER_CAPACITY * 2);

        loop {
            if writer_thread_stop_signal.load(Ordering::Relaxed) {
                println!("[AudioProcessing] Writer thread: Stop signal received at iteration {}. Breaking loop.", iteration_count);
                break;
            }

            mic_samples_f32.clear();
            loopback_samples_f32.clear();
            mixed_samples_i16.clear();

            let mic_chunk = mic_consumer.pop_slice(mic_samples_f32.capacity());
            if mic_chunk.len() > 0 {
                mic_samples_f32.extend_from_slice(mic_chunk);
                if iteration_count < LOG_INITIAL_SAMPLES_COUNT || (iteration_count % PERIODIC_LOG_INTERVAL == 0 && !mic_chunk.is_empty()) {
                     println!("[AudioProcessing] Writer (Iter {}): Popped {} raw f32 samples from mic_consumer.", iteration_count, mic_chunk.len());
                }
            }

            let has_active_loopback = actual_loopback_stream.is_some() && loopback_actual_channels.is_some();

            if has_active_loopback {
                let loopback_chunk = loopback_consumer.pop_slice(loopback_samples_f32.capacity());
                if loopback_chunk.len() > 0 {
                    loopback_samples_f32.extend_from_slice(loopback_chunk);
                     if iteration_count < LOG_INITIAL_SAMPLES_COUNT || (iteration_count % PERIODIC_LOG_INTERVAL == 0 && !loopback_chunk.is_empty()) {
                        println!("[AudioProcessing] Writer (Iter {}): Popped {} raw f32 samples from loopback_consumer.", iteration_count, loopback_chunk.len());
                    }
                }
            }

            let mut mic_idx = 0;
            let mut loop_idx = 0;

            let mut current_iteration_mic_frames_processed = 0;
            let mut current_iteration_loop_frames_processed = 0;

            while mic_idx < mic_samples_f32.len() || (has_active_loopback && loop_idx < loopback_samples_f32.len()) {
                let mut mic_l = 0.0_f32;
                let mut mic_r = 0.0_f32;
                let mut loop_l = 0.0_f32;
                let mut loop_r = 0.0_f32;

                // Get microphone frame
                if mic_idx < mic_samples_f32.len() {
                    if mic_actual_channels == 1 {
                        mic_l = mic_samples_f32[mic_idx];
                        mic_r = mic_l;
                        mic_idx += 1;
                    } else if mic_idx + 1 < mic_samples_f32.len() { // Need 2 samples for stereo
                        mic_l = mic_samples_f32[mic_idx];
                        mic_r = mic_samples_f32[mic_idx + 1];
                        mic_idx += 2;
                    } else {
                        mic_idx = mic_samples_f32.len();
                    }
                    current_iteration_mic_frames_processed +=1;
                }

                // Get loopback frame
                if has_active_loopback && loop_idx < loopback_samples_f32.len() {
                    if let Some(ch) = loopback_actual_channels {
                        if ch == 1 {
                            loop_l = loopback_samples_f32[loop_idx];
                            loop_r = loop_l;
                            loop_idx += 1;
                        } else if loop_idx + 1 < loopback_samples_f32.len() {
                            loop_l = loopback_samples_f32[loop_idx];
                            loop_r = loopback_samples_f32[loop_idx + 1];
                            loop_idx += 2;
                        } else {
                            loop_idx = loopback_samples_f32.len();
                        }
                         current_iteration_loop_frames_processed +=1;
                    }
                }

                if iteration_count < LOG_INITIAL_SAMPLES_COUNT && (mic_l != 0.0 || mic_r != 0.0 || loop_l != 0.0 || loop_r != 0.0) {
                     println!("[AudioProcessing] Writer Pre-mix (Iter {}): Mic (L:{:.4}, R:{:.4}), Loop (L:{:.4}, R:{:.4})", iteration_count, mic_l, mic_r, loop_l, loop_r);
                }

                let final_l = (mic_l + loop_l).max(-1.0).min(1.0);
                let final_r = (mic_r + loop_r).max(-1.0).min(1.0);

                mixed_samples_i16.push((final_l * std::i16::MAX as f32) as i16);
                mixed_samples_i16.push((final_r * std::i16::MAX as f32) as i16);
            }

            if (iteration_count < LOG_INITIAL_SAMPLES_COUNT || iteration_count % PERIODIC_LOG_INTERVAL == 0) && (current_iteration_mic_frames_processed > 0 || current_iteration_loop_frames_processed > 0) {
                println!("[AudioProcessing] Writer (Iter {}): Mic frames processed this iter: {}, Loopback frames processed this iter: {}. Total mixed stereo i16 samples generated: {}",
                    iteration_count, current_iteration_mic_frames_processed, current_iteration_loop_frames_processed, mixed_samples_i16.len() / 2);
            }


            if !mixed_samples_i16.is_empty() {
                if let Ok(mut guard) = writer_clone.lock() {
                    if let Some(writer) = guard.as_mut() {
                        for sample_i16 in mixed_samples_i16.iter() {
                            writer.write_sample(*sample_i16).unwrap_or_else(|e| eprintln!("[AudioProcessing] Error writing mixed sample: {}",e));
                        }
                         if iteration_count >= LOG_INITIAL_SAMPLES_COUNT && mixed_samples_i16.len() > LOG_CHUNK_THRESHOLD {
                            println!("[AudioProcessing] Writer (Iter {}): Wrote {} i16 samples ({} stereo frames) to WAV.", iteration_count, mixed_samples_i16.len(), mixed_samples_i16.len()/2);
                        }
                    }
                }
            } else {
                if !writer_thread_stop_signal.load(Ordering::Relaxed) && mic_consumer.is_empty() && (!has_active_loopback || loopback_consumer.is_empty()) {
                    if iteration_count % (PERIODIC_LOG_INTERVAL * 10) == 0 { // Log sleep less often
                        println!("[AudioProcessing] Writer (Iter {}): No data from consumers, sleeping.", iteration_count);
                    }
                    thread::sleep(Duration::from_millis(10));
                }
            }
            iteration_count += 1;
        }
        println!("[AudioProcessing] Writer thread: Loop finished. Finalizing WAV file.");
        if let Ok(mut guard) = writer_clone.lock() {
            if let Some(writer) = guard.take() {
                writer.finalize().unwrap_or_else(|e| eprintln!("[AudioProcessing] Error finalizing WAV writer: {}", e));
                 println!("[AudioProcessing] Writer thread: WAV file finalized successfully.");
            } else {
                println!("[AudioProcessing] Writer thread: WAV writer was already taken or None before finalization call.");
            }
        } else {
            eprintln!("[AudioProcessing] Writer thread: Failed to acquire lock for WAV writer finalization.");
        }
        println!("[AudioProcessing] Writer thread: Exiting.");
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
        writer: wav_writer.clone(),
        mic_stream: Some(mic_stream),
        loopback_stream: actual_loopback_stream,
        writer_thread: Some(writer_thread),
        stop_signal,
        mic_device_identifier, // Store the identifier
        loopback_device_identifier: if loopback_actual_channels.is_some() { final_loopback_device_identifier } else { None }, // Store if loopback is active
    };

    let mut recordings_map = ACTIVE_RECORDINGS.lock().unwrap();
    recordings_map.insert(recording_id.to_string(), Arc::new(Mutex::new(recording_state_data)));

    println!("Recording {} started.", recording_id);
    Ok(recording_id.to_string())
}

// Helper function to build input stream and push to a producer
fn build_input_stream_generic<T: Sample + Send + 'static>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mut producer: Producer<f32>,
    stop_signal: Arc<AtomicBool>,
    stream_name: String, // For logging
) -> Result<cpal::Stream, BuildStreamError> {

    lazy_static::lazy_static! {
        static ref STREAM_DATA_LOG_COUNT: AtomicUsize = AtomicUsize::new(0);
    }
    const MAX_STREAM_DATA_LOGS: usize = 5; // Log first few data packets globally to confirm flow

    let err_fn = move |err| {
        eprintln!("[AudioProcessing] Stream error on '{}': {}", stream_name, err);
    };

    let data_callback_stream_name = stream_name.clone();
    let device_name_for_log = device.name().unwrap_or_else(|_| "UnknownDevice".to_string());

    device.build_input_stream(
        config,
        move |data: &[T], _: &_| {
            if stop_signal.load(Ordering::Relaxed) {
                return;
            }

            let current_log_count = STREAM_DATA_LOG_COUNT.load(Ordering::Relaxed);
            if current_log_count < MAX_STREAM_DATA_LOGS {
                println!("[AudioProcessing] Data received on stream '{}' (Device: {}): {} samples. (Global log count: {})",
                    data_callback_stream_name, device_name_for_log, data.len(), current_log_count);
                STREAM_DATA_LOG_COUNT.fetch_add(1, Ordering::Relaxed);
            }

            for &sample in data.iter() {
                if producer.is_full() {
                     if STREAM_DATA_LOG_COUNT.load(Ordering::Relaxed) % 1000 == 0 { // Rate limit buffer full warnings
                        println!("[AudioProcessing] WARN: Ring buffer full for stream '{}'. Dropping samples.", data_callback_stream_name);
                     }
                    break;
                }
                producer.push(sample.to_f32()).unwrap_or_else(|_| {
                    // This is expected if writer thread stops first or during shutdown.
                });
            }
        },
        err_fn,
        None,
    )
}


// Stop recording audio
#[command]
pub fn stop_recording(recording_id: &str, db_conn: &Connection) -> Result<AudioRecording, String> {
    println!("[AudioProcessing] Command received to stop recording: {}", recording_id);
    let recording_arc = {
        let mut recordings_map = ACTIVE_RECORDINGS.lock().unwrap();
        recordings_map.remove(recording_id)
            .ok_or_else(|| format!("No active recording with ID {}", recording_id))?
    };

    let (start_time, note_id_str, file_path_buf, final_writer_arc, writer_thread_handle, stop_sig, mic_s, loop_s) = {
        let mut recording_state_guard = recording_arc.lock().unwrap();

        println!("Stopping streams for recording id: {}", recording_id);
        recording_state_guard.stop_signal.store(true, Ordering::Relaxed);

        if let Some(stream) = recording_state_guard.mic_stream.take() {
            drop(stream);
            println!("Mic stream for {} taken and will be dropped.", recording_id);
        }
        if let Some(stream) = recording_state_guard.loopback_stream.take() {
            drop(stream);
            println!("Loopback stream for {} taken and will be dropped.", recording_id);
        }

        let thread_handle = recording_state_guard.writer_thread.take();

        (
            recording_state_guard.start_time,
            recording_state_guard.note_id.clone(),
            recording_state_guard.file_path.clone(),
            recording_state_guard.writer.clone(),
            thread_handle,
            recording_state_guard.stop_signal.clone(),
            recording_state_guard.mic_stream.take(),
            recording_state_guard.loopback_stream.take()
        )
    };

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

    {
        let mut writer_guard = final_writer_arc.lock().unwrap();
        if let Some(writer) = writer_guard.take() {
            println!("WARN: Writer was not finalized by thread for {}. Finalizing now.", recording_id);
            writer.finalize().map_err(|e| format!("Failed to finalize WAV writer on stop: {}", e))?;
        }
    }

    let duration_ms = start_time.elapsed().as_millis() as u64;
    println!("Recording {} stopped. Duration: {}ms. File: {:?}", recording_id, duration_ms, file_path_buf);

    let recorded_at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let audio_recording = AudioRecording {
        id: recording_id.to_string(),
        note_id: note_id_str,
        file_path: file_path_buf.to_string_lossy().to_string(),
        duration_ms,
        recorded_at,
    };

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

