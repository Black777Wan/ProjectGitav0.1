use thiserror::Error;

#[derive(Debug, Error)]
pub enum DalError {
    #[error("Database query failed: {0}")]
    Sqlx(#[from] sqlx::Error),

    #[error("UUID parsing error: {0}")]
    Uuid(#[from] uuid::Error),

    #[error("JSON serialization/deserialization error: {0}")]
    SerdeJson(#[from] serde_json::Error),

    #[error("Item not found")]
    NotFound,

    #[error("An unexpected error occurred: {0}")]
    Internal(String),
}

// Optional: Add a blanket implementation to convert other errors to DalError::Internal
// impl<E: std::error::Error + Send + Sync + 'static> From<E> for DalError {
//     fn from(err: E) -> Self {
//         DalError::Internal(err.to_string())
//     }
// }
