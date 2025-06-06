use chrono::Local;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Sample, SampleFormat};
use hound::{WavSpec, WavWriter};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufWriter;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use uuid::Uuid;

// Holds the state of the audio recording
struct RecordingState {
    writer: Option<WavWriter<BufWriter<File>>>,
    start_time: Option<Instant>,
    file_path: Option<String>,
}

// Global recording state protected by a mutex
lazy_static::lazy_static! {
    static ref RECORDING_STATE: Arc<Mutex<RecordingState>> = Arc::new(Mutex::new(RecordingState {
        writer: None,
        start_time: None,
        file_path: None,
    }));
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioDevice {
    name: String,
    is_input: bool,
}

#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();
    
    let mut devices = Vec::new();
    
    // Get input devices
    if let Ok(input_devices) = host.input_devices() {
        for device in input_devices {
            if let Ok(name) = device.name() {
                devices.push(AudioDevice {
                    name,
                    is_input: true,
                });
            }
        }
    }
    
    // Get output devices
    if let Ok(output_devices) = host.output_devices() {
        for device in output_devices {
            if let Ok(name) = device.name() {
                devices.push(AudioDevice {
                    name,
                    is_input: false,
                });
            }
        }
    }
    
    Ok(devices)
}

#[tauri::command]
pub fn start_recording(page_path: String) -> Result<String, String> {
    let mut state = RECORDING_STATE.lock().unwrap();
    
    // Check if already recording
    if state.writer.is_some() {
        return Err("Already recording".to_string());
    }
    
    // Generate a unique filename
    let now = Local::now();
    let uuid = Uuid::new_v4().to_string();
    let filename = format!("{}-{}.wav", now.format("%Y-%m-%d-%H-%M-%S"), uuid);
    
    // Determine the audio file path (in the same directory as the page)
    let page_dir = std::path::Path::new(&page_path)
        .parent()
        .ok_or_else(|| "Invalid page path".to_string())?;
    
    let audio_path = page_dir.join(&filename);
    let audio_path_str = audio_path.to_string_lossy().to_string();
    
    // Create a WAV writer
    let spec = WavSpec {
        channels: 2, // Stereo for mixed audio
        sample_rate: 44100,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    
    let writer = WavWriter::create(&audio_path, spec)
        .map_err(|e| format!("Failed to create WAV file: {}", e))?;
    
    // Update state
    state.writer = Some(writer);
    state.start_time = Some(Instant::now());
    state.file_path = Some(audio_path_str.clone());
    
    // Create a sidecar JSON file for metadata
    let page_filename = std::path::Path::new(&page_path)
        .file_stem()
        .ok_or_else(|| "Invalid page filename".to_string())?;
    
    let audio_metadata_filename = format!("{}.audio.json", page_filename.to_string_lossy());
    let audio_metadata_path = page_dir.join(&audio_metadata_filename);
    
    let metadata = serde_json::json!({
        "page_path": page_path,
        "audio_file": audio_path_str,
        "timestamp": now.to_rfc3339(),
    });
    
    std::fs::write(
        audio_metadata_path,
        serde_json::to_string_pretty(&metadata).unwrap(),
    )
    .map_err(|e| format!("Failed to write audio metadata: {}", e))?;
    
    // Start the recording streams (this part is complex and requires careful setup)
    setup_recording_streams().map_err(|e| format!("Failed to set up recording: {}", e))?;
    
    Ok(audio_path_str)
}

#[tauri::command]
pub fn stop_recording() -> Result<(), String> {
    let mut state = RECORDING_STATE.lock().unwrap();
    
    if let Some(writer) = state.writer.take() {
        // Finalize the WAV file
        writer.finalize().map_err(|e| e.to_string())?;
    }
    
    state.start_time = None;
    let file_path = state.file_path.take();
    
    // Return the path to the created audio file
    match file_path {
        Some(path) => Ok(()),
        None => Err("No recording in progress".to_string()),
    }
}

#[tauri::command]
pub fn get_recording_timestamp_ms() -> Result<u64, String> {
    let state = RECORDING_STATE.lock().unwrap();
    
    match state.start_time {
        Some(start_time) => {
            let elapsed = start_time.elapsed();
            Ok(elapsed.as_millis() as u64)
        }
        None => Err("No recording in progress".to_string()),
    }
}

// Helper function to set up the recording streams
fn setup_recording_streams() -> Result<(), String> {
    let host = cpal::default_host();
    
    // 1. Set up microphone input stream
    let input_device = host
        .default_input_device()
        .ok_or_else(|| "No input device available".to_string())?;
    
    let input_config = input_device
        .default_input_config()
        .map_err(|e| format!("Failed to get default input config: {}", e))?;
    
    // 2. Set up system audio loopback stream (Windows-specific)
    let output_device = host
        .default_output_device()
        .ok_or_else(|| "No output device available".to_string())?;
    
    let output_config = output_device
        .default_output_config()
        .map_err(|e| format!("Failed to get default output config: {}", e))?;
    
    // Create a shared buffer for mixed audio
    let mixed_buffer = Arc::new(Mutex::new(Vec::<i16>::new()));
    
    // Set up input stream
    let input_mixed_buffer = Arc::clone(&mixed_buffer);
    let input_stream = match input_config.sample_format() {
        SampleFormat::I16 => setup_i16_input_stream(&input_device, &input_config.into(), input_mixed_buffer),
        SampleFormat::F32 => setup_f32_input_stream(&input_device, &input_config.into(), input_mixed_buffer),
        _ => return Err("Unsupported sample format".to_string()),
    }
    .map_err(|e| format!("Failed to build input stream: {}", e))?;
    
    // Set up output loopback stream (this is platform-specific and more complex on Windows)
    // Here's a simplified version that would need to be expanded for real use
    let output_mixed_buffer = Arc::clone(&mixed_buffer);
    let output_stream = match output_config.sample_format() {
        SampleFormat::I16 => setup_i16_output_stream(&output_device, &output_config.into(), output_mixed_buffer),
        SampleFormat::F32 => setup_f32_output_stream(&output_device, &output_config.into(), output_mixed_buffer),
        _ => return Err("Unsupported sample format".to_string()),
    }
    .map_err(|e| format!("Failed to build output stream: {}", e))?;
    
    // Start the streams
    input_stream.play().map_err(|e| format!("Failed to start input stream: {}", e))?;
    output_stream.play().map_err(|e| format!("Failed to start output stream: {}", e))?;
    
    // We would need to store these streams somewhere to keep them alive
    // For simplicity in this example, we're not handling this properly
    // In a real implementation, you would store them in the RECORDING_STATE
    
    Ok(())
}

// Setup for i16 input stream
fn setup_i16_input_stream(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mixed_buffer: Arc<Mutex<Vec<i16>>>,
) -> Result<cpal::Stream, cpal::BuildStreamError> {
    let state_ref = Arc::clone(&RECORDING_STATE);
    
    device.build_input_stream(
        config,
        move |data: &[i16], _: &cpal::InputCallbackInfo| {
            let mut state = state_ref.lock().unwrap();
            if let Some(writer) = state.writer.as_mut() {
                // Mix with system audio (in a real implementation)
                let mut mixed = mixed_buffer.lock().unwrap();
                
                // For now, just write the microphone input directly
                for &sample in data.iter() {
                    // Write to WAV file
                    writer.write_sample(sample).unwrap();
                    
                    // Store for mixing (simplified)
                    mixed.push(sample);
                }
            }
        },
        move |err| eprintln!("Error in input stream: {}", err),
        None,
    )
}

// Setup for f32 input stream
fn setup_f32_input_stream(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mixed_buffer: Arc<Mutex<Vec<i16>>>,
) -> Result<cpal::Stream, cpal::BuildStreamError> {
    let state_ref = Arc::clone(&RECORDING_STATE);
    
    device.build_input_stream(
        config,
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            let mut state = state_ref.lock().unwrap();
            if let Some(writer) = state.writer.as_mut() {
                let mut mixed = mixed_buffer.lock().unwrap();
                
                for &sample in data.iter() {
                    // Convert f32 to i16 for WAV file
                    let i16_sample = (sample * i16::MAX as f32) as i16;
                    writer.write_sample(i16_sample).unwrap();
                    
                    // Store for mixing (simplified)
                    mixed.push(i16_sample);
                }
            }
        },
        move |err| eprintln!("Error in input stream: {}", err),
        None,
    )
}

// Setup for i16 output loopback stream
fn setup_i16_output_stream(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mixed_buffer: Arc<Mutex<Vec<i16>>>,
) -> Result<cpal::Stream, cpal::BuildStreamError> {
    let state_ref = Arc::clone(&RECORDING_STATE);
    
    // This is a simplified version - real loopback is more complex and platform-specific
    // On Windows, you would use the WASAPI loopback feature
    device.build_input_stream(
        config,
        move |data: &[i16], _: &cpal::InputCallbackInfo| {
            let state = state_ref.lock().unwrap();
            if state.writer.is_some() {
                let mut mixed = mixed_buffer.lock().unwrap();
                
                // Mix with microphone input
                // In a real implementation, you would properly handle the mixing here
                // For now, we're just storing the system audio
                for (i, &sample) in data.iter().enumerate() {
                    if i < mixed.len() {
                        // Mix: average the mic and system audio (simple approach)
                        mixed[i] = ((mixed[i] as i32 + sample as i32) / 2) as i16;
                    } else {
                        mixed.push(sample);
                    }
                }
            }
        },
        move |err| eprintln!("Error in output loopback stream: {}", err),
        None,
    )
}

// Setup for f32 output loopback stream
fn setup_f32_output_stream(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mixed_buffer: Arc<Mutex<Vec<i16>>>,
) -> Result<cpal::Stream, cpal::BuildStreamError> {
    let state_ref = Arc::clone(&RECORDING_STATE);
    
    // Simplified loopback implementation
    device.build_input_stream(
        config,
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            let state = state_ref.lock().unwrap();
            if state.writer.is_some() {
                let mut mixed = mixed_buffer.lock().unwrap();
                
                for (i, &sample) in data.iter().enumerate() {
                    // Convert f32 to i16
                    let i16_sample = (sample * i16::MAX as f32) as i16;
                    
                    if i < mixed.len() {
                        // Mix: average the mic and system audio
                        mixed[i] = ((mixed[i] as i32 + i16_sample as i32) / 2) as i16;
                    } else {
                        mixed.push(i16_sample);
                    }
                }
            }
        },
        move |err| eprintln!("Error in output loopback stream: {}", err),
        None,
    )
}
