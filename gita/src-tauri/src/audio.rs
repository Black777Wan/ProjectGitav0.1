use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Sample, SampleFormat};
use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::command;
use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, Result as SqliteResult};
use std::collections::HashMap;

// Define a struct to hold the recording state
struct RecordingState {
    is_recording: bool,
    start_time: Instant,
    duration_ms: u64,
    note_id: String,
    file_path: PathBuf,
}

// Define a global map to store active recordings
lazy_static::lazy_static! {
    static ref ACTIVE_RECORDINGS: Mutex<HashMap<String, RecordingState>> = Mutex::new(HashMap::new());
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
    
    // Get the default input device
    let input_device = host.default_input_device()
        .ok_or_else(|| "No input device available".to_string())?;
    
    println!("Using input device: {}", input_device.name().unwrap_or_else(|_| "Unknown".to_string()));
    
    // Get the default output device for monitoring (optional)
    let output_device = host.default_output_device()
        .ok_or_else(|| "No output device available".to_string())?;
    
    println!("Using output device: {}", output_device.name().unwrap_or_else(|_| "Unknown".to_string()));
    
    // Get the default input config
    let input_config = input_device.default_input_config()
        .map_err(|e| format!("Failed to get default input config: {}", e))?;
    
    println!("Default input config: {:?}", input_config);
    
    // Create the output file
    let audio_dir_path = Path::new(audio_dir);
    std::fs::create_dir_all(audio_dir_path).map_err(|e| format!("Failed to create audio directory: {}", e))?;
    
    let file_path = audio_dir_path.join(format!("{}.wav", recording_id));
    let spec = hound::WavSpec {
        channels: input_config.channels() as u16,
        sample_rate: input_config.sample_rate().0,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    
    let writer = Arc::new(Mutex::new(
        hound::WavWriter::create(file_path.clone(), spec)
            .map_err(|e| format!("Failed to create WAV file: {}", e))?
    ));
    
    // Set up the recording state
    let recording_state = RecordingState {
        is_recording: true,
        start_time: Instant::now(),
        duration_ms: 0,
        note_id: note_id.to_string(),
        file_path: file_path.clone(),
    };
    
    ACTIVE_RECORDINGS.lock().unwrap().insert(recording_id.to_string(), recording_state);
    
    // Build the input stream
    let err_fn = move |err| {
        eprintln!("an error occurred on the input stream: {}", err);
    };
    
    let writer_clone = writer.clone();
    
    let input_stream = match input_config.sample_format() {
        SampleFormat::F32 => input_device.build_input_stream(
            &input_config.into(),
            move |data: &[f32], _: &_| {
                write_input_data(data, &writer_clone);
            },
            err_fn,
            None,
        ),
        SampleFormat::I16 => input_device.build_input_stream(
            &input_config.into(),
            move |data: &[i16], _: &_| {
                write_input_data(data, &writer_clone);
            },
            err_fn,
            None,
        ),
        SampleFormat::U16 => input_device.build_input_stream(
            &input_config.into(),
            move |data: &[u16], _: &_| {
                write_input_data(data, &writer_clone);
            },
            err_fn,
            None,
        ),
        _ => return Err("Unsupported sample format".to_string()),
    }.map_err(|e| format!("Failed to build input stream: {}", e))?;
    
    // Start the input stream
    input_stream.play().map_err(|e| format!("Failed to start input stream: {}", e))?;
    
    // Store the stream to keep it alive (this is just a placeholder, in a real app we'd store this properly)
    std::thread::spawn(move || {
        // Keep the stream alive until recording is stopped
        while ACTIVE_RECORDINGS.lock().unwrap().contains_key(recording_id) {
            std::thread::sleep(Duration::from_millis(100));
        }
        // The stream will be dropped when this thread exits
    });
    
    Ok(recording_id.to_string())
}

// Write input data to the WAV file
fn write_input_data<T>(input: &[T], writer: &Arc<Mutex<hound::WavWriter<BufWriter<File>>>>)
where
    T: Sample + hound::Sample,
{
    if let Ok(mut guard) = writer.lock() {
        for &sample in input.iter() {
            let sample: i16 = sample.to_i16();
            guard.write_sample(sample).unwrap();
        }
    }
}

// Stop recording audio
#[command]
pub fn stop_recording(recording_id: &str, db_conn: &Connection) -> Result<AudioRecording, String> {
    let mut recordings = ACTIVE_RECORDINGS.lock().unwrap();
    
    // Get the recording state
    let recording_state = recordings.remove(recording_id)
        .ok_or_else(|| format!("No active recording with ID {}", recording_id))?;
    
    // Calculate the duration
    let duration_ms = recording_state.start_time.elapsed().as_millis() as u64;
    
    // Create the audio recording record
    let recorded_at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    
    let audio_recording = AudioRecording {
        id: recording_id.to_string(),
        note_id: recording_state.note_id,
        file_path: recording_state.file_path.to_string_lossy().to_string(),
        duration_ms,
        recorded_at: recorded_at.clone(),
    };
    
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

