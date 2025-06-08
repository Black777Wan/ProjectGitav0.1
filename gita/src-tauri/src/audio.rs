use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{BuildStreamError, Sample, SampleFormat, StreamConfig}; // Removed SupportedStreamConfig
use ringbuf::{HeapRb, Producer}; // Removed Consumer
use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};
use sqlx::PgPool;
use uuid::Uuid;
use crate::audio_handler::{self, AudioRecording as DalAudioRecording};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering, AtomicUsize}};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
// Removed: use rusqlite::{params, Connection};
use std::collections::HashMap; // Keep for ACTIVE_RECORDINGS

// Define a struct to hold the recording state
struct RecordingState {
    // is_recording is implicit if the entry exists in ACTIVE_RECORDINGS
    start_time: Instant,
    page_id: Option<String>, // MODIFIED from note_id: String
    file_path: PathBuf,
    writer: Arc<Mutex<Option<hound::WavWriter<BufWriter<File>>>>>,
    // mic_stream: Option<cpal::Stream>, // These are !Send, managed by their thread.
    // loopback_stream: Option<cpal::Stream>, // These are !Send, managed by their thread.
    mic_stream_thread: Option<JoinHandle<()>>,
    loopback_stream_thread: Option<JoinHandle<()>>,
    writer_thread: Option<JoinHandle<()>>,
    stop_signal: Arc<AtomicBool>,
}

lazy_static::lazy_static! {
    static ref ACTIVE_RECORDINGS: Mutex<HashMap<String, Arc<Mutex<RecordingState>>>> = Mutex::new(HashMap::new());
    // Global host, initialized on first use. Keep it alive for callbacks.
    static ref GLOBAL_HOST: Mutex<Option<cpal::Host>> = Mutex::new(None);
    // Ensures devices_changed_callback is registered only once.
    // static ref DEVICE_CHANGE_LISTENER_REGISTERED: AtomicBool = AtomicBool::new(false);
}


// This callback function will be invoked by CPAL when audio devices change.
// It needs to be `Send + 'static` if it's registered globally.
// To interact with ACTIVE_RECORDINGS, it must be carefully designed.
/*
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
*/

// Removed local AudioRecording and AudioBlockReference structs

// Start recording audio
pub fn start_recording(page_id_opt: Option<&str>, recording_id: &str, audio_dir: &str) -> Result<String, String> {
    // --- Device Variables ---
    let mic_device: cpal::Device;
    let mut available_input_devices: Vec<cpal::Device> = Vec::new();
    // loopback_device and loopback_device_identifier are determined after host lock.

    // --- Host Initialization and Device Enumeration Scope ---
    { // New scope to limit the lifetime of host_guard and host_ref
        let mut host_guard = GLOBAL_HOST.lock().unwrap();
        if host_guard.is_none() {
            println!("Initializing global CPAL host.");
            *host_guard = Some(cpal::default_host());
        }
        let host_ref = host_guard.as_ref().expect("GLOBAL_HOST should be initialized after check");

        println!("Selected host: {}", host_ref.id().name());
        println!("Probing for available input devices...");
        match host_ref.input_devices() {
            Ok(devices) => {
                for (idx, device_candidate) in devices.enumerate() {
                    match device_candidate.name() {
                        Ok(name) => {
                            let mut log_line = format!("  Input Device {}: \"{}\"", idx, name);
                            if let Ok(config) = device_candidate.default_input_config() {
                                log_line.push_str(&format!(" (Default config: {} channels, {} Hz, {:?})", config.channels(), config.sample_rate().0, config.sample_format()));
                            }
                            println!("{}", log_line);
                            available_input_devices.push(device_candidate.clone()); // Clone for use after lock
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

        mic_device = host_ref.default_input_device()
            .ok_or_else(|| "No default microphone input device available".to_string())?;
        // mic_device is cloned here by ok_or_else -> ok -> map, or default_input_device itself might return owned/cloned.
        // If not, mic_device = host_ref.default_input_device()....?.clone(); may be needed if mic_device must own.
        // Assuming default_input_device() gives ownership or a clone, or a 'static ref if that were possible (it's not for Device).
        // For safety, let's assume it's cloned or owned. CPAL Device struct is usually cloneable.
    } // GLOBAL_HOST lock is released here

    // --- Post-Host-Lock Device Processing ---
    let mic_device_identifier = mic_device.name().map_err(|e| format!("Failed to get mic device name: {}", e))?;
    println!("Default microphone device selected: '{}'", mic_device_identifier);
    if let Ok(config) = mic_device.default_input_config() { // This uses the now-owned mic_device
        println!("  Default mic config: {} channels, {} Hz, {:?}", config.channels(), config.sample_rate().0, config.sample_format());
    }

    // Commented-out device change listener registration - this used to be here
    /*
    if cfg!(windows) && !DEVICE_CHANGE_LISTENER_REGISTERED.load(Ordering::Relaxed) {
        // ...
        // match host.devices_changed_event_stream() { ... } // host is no longer in scope
        // ...
    }
    */

    // Loopback device selection using the populated available_input_devices
    let mut loopback_device: Option<cpal::Device> = None;
    let mut loopback_device_identifier: Option<String> = None;

    if cfg!(windows) {
        println!("Attempting to find specific loopback device on Windows...");
        for device_candidate in available_input_devices.iter() { // Iterate over the cloned devices
            if let Ok(name) = device_candidate.name() {
                if name.contains("Stereo Mix") || name.contains("Wave Out Mix") || name.contains("What U Hear") || name.contains("Loopback") {
                    loopback_device = Some(device_candidate.clone()); // Clone again for ownership by Option
                    loopback_device_identifier = Some(name);
                    break;
                }
            }
        }
        if let Some(ref id) = loopback_device_identifier {
            println!("Windows loopback device found and selected: '{}'", id);
        } else {
            println!("WARN: No specific Windows loopback device (Stereo Mix, etc.) found. Will record microphone only.");
        }
    } else if cfg!(target_os = "macos") {
        println!("INFO: Automatic loopback device selection is not implemented for macOS. Logged candidates may be manually selectable in the future.");
    } else if cfg!(target_os = "linux") {
        println!("INFO: Automatic loopback device selection is not implemented for Linux. Logged candidates may be manually selectable in the future.");
    } else {
        println!("INFO: Loopback device detection is OS-specific. Microphone only for this platform unless a generic input device serves as loopback.");
    }

    // --- Configuration ---
    const TARGET_SAMPLE_RATE: u32 = 48000;
    let target_sample_format = SampleFormat::F32; // Process as f32, convert to i16 for WAV

    // Configure Microphone
    let supported_mic_config = mic_device.default_input_config()
        .map_err(|e| format!("Failed to get default mic config: {}", e))?;
    let mut stream_mic_config: StreamConfig = supported_mic_config.into();
    stream_mic_config.sample_rate = cpal::SampleRate(TARGET_SAMPLE_RATE);

    let supports_target_rate_mic = mic_device.supported_input_configs()
        .map_err(|e| format!("Failed to get supported mic configs: {}", e))?
        .any(|range| {
            let config_at_target_rate = range.with_sample_rate(cpal::SampleRate(TARGET_SAMPLE_RATE));
            config_at_target_rate.channels() <= 2 && config_at_target_rate.sample_format() == target_sample_format
        });

    if !supports_target_rate_mic {
        println!("WARN: Microphone does not support {} Hz sample rate with f32 format. Using default.", TARGET_SAMPLE_RATE);
        let fallback_supported_config = mic_device.default_input_config().map_err(|e| format!("Failed to get default mic config: {}", e))?;
        stream_mic_config = fallback_supported_config.into(); // Re-assign, sample rate will be default
    }

    // Try to set to stereo, fall back to mono
    let original_mic_channels = stream_mic_config.channels; // Channels from current config (either target rate or default)

    let supports_stereo_mic = mic_device.supported_input_configs()
        .map_err(|e| format!("Failed to get supported mic configs: {}", e))?
        .any(|range| {
            let config_at_current_rate = range.with_sample_rate(stream_mic_config.sample_rate);
            config_at_current_rate.channels() == 2 && config_at_current_rate.sample_format() == target_sample_format
        });

    if supports_stereo_mic {
        stream_mic_config.channels = 2;
        println!("Microphone configured for stereo input at {:?}.", stream_mic_config.sample_rate);
    } else {
        let supports_mono_mic = mic_device.supported_input_configs()
            .map_err(|e| format!("Failed to get supported mic configs: {}", e))?
            .any(|range| {
                let config_at_current_rate = range.with_sample_rate(stream_mic_config.sample_rate);
                config_at_current_rate.channels() == 1 && config_at_current_rate.sample_format() == target_sample_format
            });
        if supports_mono_mic {
            stream_mic_config.channels = 1;
            println!("Microphone configured for mono input at {:?}. Will be upmixed to stereo.", stream_mic_config.sample_rate);
        } else {
            println!("WARN: Microphone does not support stereo or mono at {:?}. Using original channels: {}.", stream_mic_config.sample_rate, original_mic_channels);
            stream_mic_config.channels = original_mic_channels; // Keep original channels if specific fallbacks fail
        }
    }    let final_mic_config: StreamConfig = stream_mic_config;
    let mic_actual_channels = final_mic_config.channels;
    println!("[AudioProcessing] Final Microphone config: Channels: {}, Rate: {}Hz", 
         final_mic_config.channels, final_mic_config.sample_rate.0);
    if final_mic_config.sample_rate.0 != TARGET_SAMPLE_RATE {
        println!("[AudioProcessing] WARN: Mic stream sample rate {} Hz differs from target WAV rate {} Hz.", final_mic_config.sample_rate.0, TARGET_SAMPLE_RATE);
    }

    // Configure Loopback
    let mut loopback_config_final: Option<StreamConfig> = None;
    // let final_loopback_device_identifier = loopback_device_identifier.clone(); // Removed

    if let Some(ref dev) = loopback_device {
        let supported_loop_config = dev.default_input_config()
            .map_err(|e| format!("Failed to get default loopback config: {}", e))?;
        let mut stream_loop_config: StreamConfig = supported_loop_config.into();
        stream_loop_config.sample_rate = cpal::SampleRate(TARGET_SAMPLE_RATE);

        let supports_target_rate_loop = dev.supported_input_configs()
            .map_err(|e| format!("Failed to get supported loopback configs: {}", e))?
            .any(|range| {
                let config_at_target_rate = range.with_sample_rate(cpal::SampleRate(TARGET_SAMPLE_RATE));
                config_at_target_rate.channels() <= 2 && config_at_target_rate.sample_format() == target_sample_format
            });

        if !supports_target_rate_loop {
            println!("[AudioProcessing] WARN: Loopback device does not support {} Hz sample rate with f32 format. Using default.", TARGET_SAMPLE_RATE);
            let fallback_supported_config = dev.default_input_config().map_err(|e| format!("Failed to get default loopback config: {}", e))?;
            stream_loop_config = fallback_supported_config.into(); // Re-assign, sample rate will be default
        }

        let original_loop_channels = stream_loop_config.channels;

        let supports_stereo_loop = dev.supported_input_configs()
            .map_err(|e| format!("Failed to get supported loopback configs: {}", e))?
            .any(|range| {
                let config_at_current_rate = range.with_sample_rate(stream_loop_config.sample_rate);
                config_at_current_rate.channels() == 2 && config_at_current_rate.sample_format() == target_sample_format
            });

        if supports_stereo_loop {
            stream_loop_config.channels = 2;
            println!("[AudioProcessing] Loopback device configured for stereo input at {:?}.", stream_loop_config.sample_rate);
        } else {
            let supports_mono_loop = dev.supported_input_configs()
                .map_err(|e| format!("Failed to get supported loopback configs: {}", e))?
                .any(|range| {
                    let config_at_current_rate = range.with_sample_rate(stream_loop_config.sample_rate);
                    config_at_current_rate.channels() == 1 && config_at_current_rate.sample_format() == target_sample_format
                });
            if supports_mono_loop {
                stream_loop_config.channels = 1;
                println!("[AudioProcessing] Loopback device configured for mono input at {:?}. Will be upmixed to stereo.", stream_loop_config.sample_rate);
            } else {
                println!("[AudioProcessing] WARN: Loopback device does not support stereo or mono at {:?}. Using default channels: {}.", stream_loop_config.sample_rate, original_loop_channels);
                stream_loop_config.channels = original_loop_channels;
            }        }        let final_loop_conf: StreamConfig = stream_loop_config;
        loopback_actual_channels = Some(final_loop_conf.channels);
        loopback_config_final = Some(final_loop_conf.clone());
        println!("[AudioProcessing] Final Loopback config: Channels: {}, Rate: {}Hz", 
         final_loop_conf.channels, final_loop_conf.sample_rate.0);
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
    let _err_fn = |err: cpal::StreamError| {
        eprintln!("An error occurred on an audio stream: {}", err);
    };

    let mic_stream_stop_signal = stop_signal.clone();
    let mic_device_name_log = mic_device.name().unwrap_or_else(|_| "Unknown Mic".to_string());
    let mic_stream = build_input_stream_generic::<f32>(&mic_device, &final_mic_config, mic_producer, mic_stream_stop_signal, mic_device_name_log.clone())
        .map_err(|e| format!("Failed to build microphone stream: {}", e))?;
    println!("[AudioProcessing] Microphone stream built for device: '{}'", mic_device_name_log);

    let mut actual_loopback_stream: Option<cpal::Stream> = None;
    if let (Some(dev), Some(conf)) = (loopback_device.as_ref(), loopback_config_final.as_ref()) {
        let loopback_device_name_log = dev.name().unwrap_or_else(|_| "Unknown Loopback".to_string());
        match build_input_stream_generic::<f32>(dev, conf, loopback_producer, stop_signal.clone(), loopback_device_name_log.clone()) {
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
    
    // Extract loopback status before moving into thread to avoid Send issues
    let loopback_is_active = actual_loopback_stream.is_some() && loopback_actual_channels.is_some();

    let writer_thread = thread::spawn(move || {
        let mut iteration_count: u64 = 0; // For logging initial samples and periodic updates
        const LOG_INITIAL_SAMPLES_COUNT: u64 = 5; // Log first N iterations with pre-mix values
        const LOG_CHUNK_THRESHOLD: usize = 2000; // Log if more than this many i16 samples are written
        const PERIODIC_LOG_INTERVAL: u64 = 100; // Log summary every N iterations after initial phase

        println!("[AudioProcessing] Writer thread started. Mic source channels: {}. Loopback active: {}, Loopback source channels: {:?}",
            mic_actual_channels,
            loopback_is_active,
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

            // Temporary buffers for pop_slice
            let mut temp_mic_buffer = vec![0.0f32; RING_BUFFER_CAPACITY];
            let mut temp_loopback_buffer = vec![0.0f32; RING_BUFFER_CAPACITY];

            let num_popped_mic = mic_consumer.pop_slice(&mut temp_mic_buffer);
            if num_popped_mic > 0 {
                mic_samples_f32.extend_from_slice(&temp_mic_buffer[..num_popped_mic]);
                if iteration_count < LOG_INITIAL_SAMPLES_COUNT || (iteration_count % PERIODIC_LOG_INTERVAL == 0 && num_popped_mic > 0) {
                     println!("[AudioProcessing] Writer (Iter {}): Popped {} raw f32 samples from mic_consumer.", iteration_count, num_popped_mic);
                }
            }

            let has_active_loopback = loopback_is_active;

            if has_active_loopback {
                let num_popped_loopback = loopback_consumer.pop_slice(&mut temp_loopback_buffer);
                if num_popped_loopback > 0 {
                    loopback_samples_f32.extend_from_slice(&temp_loopback_buffer[..num_popped_loopback]);
                     if iteration_count < LOG_INITIAL_SAMPLES_COUNT || (iteration_count % PERIODIC_LOG_INTERVAL == 0 && num_popped_loopback > 0) {
                        println!("[AudioProcessing] Writer (Iter {}): Popped {} raw f32 samples from loopback_consumer.", iteration_count, num_popped_loopback);
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
    });    // --- Play Streams and Store State ---
    mic_stream.play().map_err(|e| format!("Failed to play mic stream: {}", e))?;
    let mic_thread_stop_signal = stop_signal.clone();
    let mic_stream_thread = std::thread::spawn(move || {
        // Note: We can't move the stream into the thread due to Send trait issues
        // The stream will be dropped when this function ends, but that's okay
        // because the stream callbacks will continue running until the stop signal
        loop {
            if mic_thread_stop_signal.load(Ordering::Relaxed) {
                println!("[AudioProcessing] Mic stream thread: Stop signal received. Exiting.");
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        println!("[AudioProcessing] Mic stream thread: Finished.");
    });

    let mut loopback_stream_thread: Option<JoinHandle<()>> = None;
    if let Some(stream) = actual_loopback_stream {
        stream.play().map_err(|e| format!("Failed to play loopback stream: {}", e))?;
        println!("Both microphone and loopback streams are playing.");
        let loop_thread_stop_signal = stop_signal.clone();
        loopback_stream_thread = Some(std::thread::spawn(move || {
            // Note: We can't move the stream into the thread due to Send trait issues
            // The stream will be dropped when this function ends, but that's okay
            // because the stream callbacks will continue running until the stop signal
            loop {
                if loop_thread_stop_signal.load(Ordering::Relaxed) {
                    println!("[AudioProcessing] Loopback stream thread: Stop signal received. Exiting.");
                    break;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            println!("[AudioProcessing] Loopback stream thread: Finished.");
        }));
    } else {
        println!("Only microphone stream is playing.");
    }

    let recording_state_data = RecordingState {
        start_time: Instant::now(),
        page_id: page_id_opt.map(|s| s.to_string()),
        file_path: file_path.clone(),
        writer: wav_writer.clone(),
        mic_stream_thread: Some(mic_stream_thread),
        loopback_stream_thread,
        writer_thread: Some(writer_thread),
        stop_signal,
        // mic_device_identifier, // Store the identifier // Removed
        // loopback_device_identifier: if loopback_actual_channels.is_some() { final_loopback_device_identifier } else { None }, // Store if loopback is active // Removed
    };

    let mut recordings_map = ACTIVE_RECORDINGS.lock().unwrap();
    recordings_map.insert(recording_id.to_string(), Arc::new(Mutex::new(recording_state_data)));

    println!("Recording {} started.", recording_id);
    Ok(recording_id.to_string())
}

// Helper function to build input stream and push to a producer
fn build_input_stream_generic<T: Sample + Send + cpal::SizedSample + 'static>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mut producer: Producer<f32, Arc<HeapRb<f32>>>,
    stop_signal: Arc<AtomicBool>,
    stream_name: String, // For logging
) -> Result<cpal::Stream, BuildStreamError> 
where
    T: cpal::Sample,
    f32: cpal::FromSample<T>,
{
    lazy_static::lazy_static! {
        static ref STREAM_DATA_LOG_COUNT: AtomicUsize = AtomicUsize::new(0);
    }
    const MAX_STREAM_DATA_LOGS: usize = 5; // Log first few data packets globally to confirm flow

    let data_callback_stream_name = stream_name.clone();
    let error_callback_stream_name = stream_name.clone();
    let device_name_for_log = device.name().unwrap_or_else(|_| "UnknownDevice".to_string());
    
    let err_fn = move |err| {
        eprintln!("[AudioProcessing] Stream error on '{}': {}", error_callback_stream_name, err);
    };

    device.build_input_stream(
        config,
        move |data: &[T], _: &_| {
            if stop_signal.load(Ordering::Relaxed) {
                return;
            }            let current_log_count = STREAM_DATA_LOG_COUNT.load(Ordering::Relaxed);
            if current_log_count < MAX_STREAM_DATA_LOGS {
                println!("[AudioProcessing] Data received on stream '{}' (Device: {}): {} samples. (Global log count: {})",
                    data_callback_stream_name, device_name_for_log, data.len(), current_log_count);
                STREAM_DATA_LOG_COUNT.fetch_add(1, Ordering::Relaxed);
            }            for &sample_val in data.iter() { // Assuming loop variable is sample_val based on full context
                if producer.is_full() {
                     if STREAM_DATA_LOG_COUNT.load(Ordering::Relaxed) % 1000 == 0 { 
                        println!("[AudioProcessing] WARN: Ring buffer full for stream '{}'. Dropping samples.", data_callback_stream_name);
                     }
                    break;
                }let f32_sample: f32 = f32::from_sample(sample_val);
                producer.push(f32_sample).unwrap_or_else(|_| {
                    // This is expected if writer thread stops first or during shutdown.
                });
            }
        },
        err_fn,
        None,
    )
}

// New async stop_recording function
pub async fn stop_recording(
    recording_id_key: String, // This is the String version of UUID from ACTIVE_RECORDINGS key
    db_pool: &PgPool,
) -> Result<DalAudioRecording, String> {
    println!("[AudioProcessing] Command received to stop recording: {}", recording_id_key);

    let recording_arc = {
        let mut recordings_map = ACTIVE_RECORDINGS.lock().unwrap();
        recordings_map.remove(&recording_id_key)
            .ok_or_else(|| format!("No active recording with ID {}", recording_id_key))?
    };

    let (
        start_time,
        page_id_str_opt,
        file_path_buf,
        final_writer_arc,
        writer_thread_handle,
        mic_stream_thread_handle,
        loop_stream_thread_handle
    ) = {
        let mut recording_state_guard = recording_arc.lock().unwrap();
        println!("[AudioProcessing] Stop recording {}: Setting stop signal.", recording_id_key);
        recording_state_guard.stop_signal.store(true, Ordering::Relaxed); // Signal all threads
        (
            recording_state_guard.start_time,
            recording_state_guard.page_id.clone(),
            recording_state_guard.file_path.clone(),
            recording_state_guard.writer.clone(),
            recording_state_guard.writer_thread.take(),
            recording_state_guard.mic_stream_thread.take(),
            recording_state_guard.loopback_stream_thread.take()
        )
    };

    println!("[AudioProcessing] Stop recording {}: Waiting for writer thread to finish.", recording_id_key);
    if let Some(handle) = writer_thread_handle {
        if let Err(e) = handle.join() {
            eprintln!("[AudioProcessing] Error joining writer thread for {}: {:?}", recording_id_key, e);
        } else {
            println!("[AudioProcessing] Writer thread for {} joined successfully.", recording_id_key);
        }
    } else {
         eprintln!("[AudioProcessing] WARN: No writer thread handle found for recording id: {}. File might not be complete.", recording_id_key);
    }

    if let Some(handle) = mic_stream_thread_handle {
        if let Err(e) = handle.join() {
            eprintln!("[AudioProcessing] Error joining mic stream thread for {}: {:?}", recording_id_key, e);
        } else {
            println!("[AudioProcessing] Mic stream thread for {} joined successfully.", recording_id_key);
        }
    }

    if let Some(handle) = loop_stream_thread_handle {
        if let Err(e) = handle.join() {
            eprintln!("[AudioProcessing] Error joining loopback stream thread for {}: {:?}", recording_id_key, e);
        } else {
            println!("[AudioProcessing] Loopback stream thread for {} joined successfully.", recording_id_key);
        }
    }

    {
        let mut writer_guard = final_writer_arc.lock().unwrap();
        if let Some(writer) = writer_guard.take() {
             if let Err(e) = writer.finalize() {
                eprintln!("WARN: Failed to finalize WAV writer for {}: {}. Continuing metadata saving.", recording_id_key, e);
             } else {
                println!("[AudioProcessing] WAV writer for {} finalized successfully by stop_recording.", recording_id_key);
             }
        }
    }

    let duration_ms = start_time.elapsed().as_millis();
    let file_path_string = file_path_buf.to_string_lossy().to_string();
    println!("Recording {} stopped. Duration: {}ms. File: {}", recording_id_key, duration_ms, file_path_string);

    let page_uuid: Option<Uuid> = match page_id_str_opt {
        Some(id_str) => match Uuid::parse_str(&id_str) {
            Ok(uuid) => Some(uuid),
            Err(e) => {
                eprintln!("Error parsing page_id '{}' for recording {}: {}. Recording will be saved without page association.", id_str, recording_id_key, e);
                None
            }
        },
        None => None,
    };

    let recording_uuid = Uuid::parse_str(&recording_id_key)
        .map_err(|e| format!("Failed to parse recording_id_key '{}' as UUID: {}", recording_id_key, e))?;
    // Remove the _frontend_recording_uuid variable, just use recording_uuid

    // Save metadata to PostgreSQL
    let db_inserted_id = audio_handler::create_audio_recording( // Renamed new_db_id to db_inserted_id for clarity
        db_pool,
        recording_uuid, // <<<< PASS THE PARSED recording_uuid AS THE ID
        page_uuid,
        &file_path_string,
        Some("audio/wav"),
        Some(duration_ms as i32),
    )
    .await
    .map_err(|e| format!("Failed to insert recording metadata into database: {}", e))?;

    if db_inserted_id != recording_uuid {
         // This warning is now more critical. It means the RETURNING id was different, which shouldn't happen
         // if the INSERT uses the provided recording_uuid. This might indicate an issue with the query
         // or table definition (e.g. if id still had DEFAULT on insert even when value provided).
         // Given the query, this path should ideally not be hit.
         eprintln!("CRITICAL WARN: ID returned from DB ({}) differs from frontend-provided recording UUID ({}). Check INSERT logic in audio_handler.", db_inserted_id, recording_uuid);
    }

    // Fetch the full DalAudioRecording to return, using the ID we intended to insert.
    let dal_recording = audio_handler::get_audio_recording(db_pool, recording_uuid) // Use recording_uuid here
        .await
        .map_err(|e| format!("Failed to fetch audio recording with intended ID {}: {}", recording_uuid, e))?
        .ok_or_else(|| format!("Audio recording with ID {} not found after attempting insert.", recording_uuid))?;

    Ok(dal_recording)
}

// Removed old SQLite-specific functions:
// - get_audio_recordings
// - get_audio_block_references
// - create_audio_block_reference

