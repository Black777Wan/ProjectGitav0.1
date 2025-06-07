use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;
use regex::Regex; // Added for parsing
use lazy_static::lazy_static; // Added for static Regex

// Import the shared DalError
use crate::dal_error::DalError;
// Import handlers (will be needed later)
use crate::link_handler;
use crate::block_handler;


// Helper structs for parsing
#[derive(Debug, Clone, Eq, PartialEq, Hash)] // Added Eq, PartialEq, Hash for ExtractedBlockInfo to use in HashSet
struct ExtractedBlockInfo {
    id: Uuid,
    block_type: Option<String>,
    parent_block_id: Option<Uuid>, // ID of the direct parent block from content_json
    // Add other fields like order if needed
}

#[derive(Debug, Clone)]
struct ParsedPageLink {
    source_page_id: Uuid,
    target_title: Option<String>,
    target_id: Option<Uuid>,
    // If we need to identify which block a page link is in (e.g. for rich text editing later)
    // referencing_block_id: Option<Uuid>
}

#[derive(Debug, Clone)]
struct ParsedBlockReference {
    source_page_id: Uuid, // The page where this reference ((())) is made
    referencing_block_id: Uuid, // The block ID from content_json that contains the reference
    referenced_block_id: Uuid, // The block ID that is being pointed to
}


lazy_static! {
    static ref PAGE_LINK_REGEX: Regex = Regex::new(r"\[\[(.*?)\]\]").unwrap();
    static ref BLOCK_REF_REGEX: Regex = Regex::new(r"\(\(\((.*?)\)\)\)").unwrap();
}

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct Page {
    pub id: Uuid,
    pub title: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub content_json: Value,
    pub raw_markdown: Option<String>,
}

pub async fn create_page(
    pool: &PgPool,
    title: &str,
    content_json: Value,
    raw_markdown: Option<&str>,
) -> Result<Uuid, DalError> {
    let new_id = Uuid::new_v4();
    let query_result = sqlx::query!(
        r#"
        INSERT INTO pages (id, title, content_json, raw_markdown, created_at, updated_at)
        VALUES ($1, $2, $3, $4, now(), now())
        RETURNING id
        "#,
        new_id,
        title,
        content_json,
        raw_markdown
    )
    .fetch_one(pool)
    .await?;

    Ok(query_result.id)
}

pub async fn get_page(pool: &PgPool, id: Uuid) -> Result<Option<Page>, DalError> {
    let page = sqlx::query_as!(
        Page,
        r#"
        SELECT id, title, content_json, raw_markdown, created_at, updated_at
        FROM pages
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool)
    .await?;

    Ok(page)
}

pub async fn list_pages(pool: &PgPool) -> Result<Vec<Page>, DalError> {
    let pages = sqlx::query_as!(
        Page,
        r#"
        SELECT id, title, content_json, raw_markdown, created_at, updated_at
        FROM pages
        ORDER BY updated_at DESC
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(pages)
}

// Still to implement:
// update_page
// delete_page
// search_pages

pub async fn update_page(
    pool: &PgPool,
    id: Uuid,
    title: Option<&str>,
    content_json: Option<Value>,
    raw_markdown: Option<Option<&str>>, // Option<Option<T>> to distinguish between no-update and set-to-NULL
) -> Result<bool, DalError> {
    // Block synchronization, link and reference handling if content_json is updated
    if let Some(new_content_json) = &content_json {
        // 1. Extract blocks, links, and references from the new content
        let (parsed_links, parsed_block_refs, extracted_blocks) =
            extract_links_references_and_blocks(new_content_json, id);

        // --- Block Synchronization ---
        // Get existing blocks for this page from the DB
        let existing_db_blocks = block_handler::get_blocks_for_page(pool, id).await?;
        let existing_db_block_ids: std::collections::HashSet<Uuid> =
            existing_db_blocks.iter().map(|b| b.id).collect();
        let extracted_block_ids: std::collections::HashSet<Uuid> =
            extracted_blocks.iter().map(|eb| eb.id).collect();

        // Blocks to Delete: in existing_db_block_ids but not in extracted_block_ids
        for block_id_to_delete in existing_db_block_ids.difference(&extracted_block_ids) {
            // Before deleting a block, ensure related entities like block_references are handled.
            // Current link_handler::remove_all_block_references_from_referencing_page below
            // will clear references *originating* from this page. If this block is referenced BY
            // other pages, those references will remain (which might be desired, or might need cleanup).
            // Also, if blocks are nested, deleting a parent might orphan children if not handled.
            // For now, we proceed with direct deletion.
            if let Err(e) = block_handler::delete_block(pool, *block_id_to_delete).await {
                 eprintln!("Failed to delete block {}: {}", block_id_to_delete, e);
                 // Decide if to continue or return error. For now, log and continue.
            }
        }

        // Blocks to Add: in extracted_block_ids but not in existing_db_block_ids
        for eb_to_add in extracted_blocks.iter().filter(|eb| !existing_db_block_ids.contains(&eb.id)) {
            // The block_handler::create_block needs to accept the ID.
            // This will be addressed in Step 3 of the subtask.
            if let Err(e) = block_handler::create_block(
                pool,
                eb_to_add.id, // This is the ID from content_json
                id,           // page_id
                eb_to_add.parent_block_id,
                eb_to_add.block_type.as_deref(),
            )
            .await {
                eprintln!("Failed to create block {}: {}", eb_to_add.id, e);
                // Decide if to continue or return error.
            }
        }
        // TODO: Handle Blocks to Update (if type or parent_id changes). For now, focusing on add/delete.


        // --- Link and Reference Processing (after block sync) ---
        // 2. Clear existing links/references for this page
        link_handler::remove_all_page_links_from_source(pool, id).await?;
        link_handler::remove_all_block_references_from_referencing_page(pool, id).await?;

        // 3. Add new page links
        for plink in parsed_links {
            if let Some(target_id) = plink.target_id {
                link_handler::add_page_link(pool, id, target_id).await?;
            } else if let Some(target_title) = plink.target_title {
                if let Some(target_page) = get_page_by_title(pool, &target_title).await? {
                    link_handler::add_page_link(pool, id, target_page.id).await?;
                } else {
                    eprintln!("Broken link: Page with title '{}' not found.", target_title);
                }
            }
        }

        // 4. Add new block references
        for bref in parsed_block_refs {
            match block_handler::get_page_id_for_block(pool, bref.referenced_block_id).await? {
                Some(referenced_page_id) => {
                    link_handler::add_block_reference(
                        pool,
                        id, // referencing_page_id (current page)
                        bref.referencing_block_id,
                        referenced_page_id,
                        bref.referenced_block_id,
                    )
                    .await?;
                }
                None => {
                    // Log details about the broken reference
                    eprintln!(
                        "Skipping block reference from page {} block {} to non-existent block ID: {}",
                        id, // source_page_id is the current page being updated
                        bref.referencing_block_id,
                        bref.referenced_block_id
                    );
                }
            }
        }
    }

    // Build the query dynamically based on which fields are provided for the page itself update
    let mut set_clauses = Vec::new();
    let mut params_count = 1; // Start with $1 for id

    if title.is_some() {
        params_count += 1;
        set_clauses.push(format!("title = ${}", params_count));
    }
    // Use the potentially modified content_json if it was part of the input
    if content_json.is_some() {
        params_count += 1;
        set_clauses.push(format!("content_json = ${}", params_count));
    }
    if raw_markdown.is_some() {
        params_count += 1;
        set_clauses.push(format!("raw_markdown = ${}", params_count));
    }

    if set_clauses.is_empty() && content_json.is_none() { // if only content_json was updated, set_clauses might be empty
        // No actual page table fields to update, but links might have been.
        // If content_json was also none, then truly nothing to do.
        if content_json.is_none() { return Ok(false); }
        // If content_json was Some, link updates happened, but page table itself might not need an update
        // unless we want to bump updated_at. Let's assume for now link updates don't bump page updated_at
        // unless content_json field itself changes.
        // However, the current logic below will add updated_at = now() if any other field changes.
        // To ensure updated_at is bumped if content_json is updated (even if other fields are not):
        if content_json.is_some() && set_clauses.is_empty() {
             // This case means only content_json was provided, and it was processed for links.
             // We still need to update the actual content_json in the DB and updated_at.
             // The existing logic for adding content_json to set_clauses handles this.
             // So, if set_clauses is empty here, it means title, raw_markdown were None,
             // and content_json was also None (already checked by outer if).
             // This part of the logic seems a bit convoluted now. Let's simplify.
        }
    }

    // If no fields to update for the page table itself, and content_json was not updated (already handled above)
    // then we can return.
    // However, if content_json was updated, link processing happened.
    // The page table update must proceed if content_json (the field) is being set.
    if set_clauses.is_empty() {
         // This means title, content_json (as a field to set), and raw_markdown were all None.
         // Link processing for a new content_json would have been handled by the `if let Some(new_content_json) = &content_json` block.
         // If content_json was Some, then set_clauses would not be empty.
         // Therefore, if set_clauses is empty here, it means no page fields need updating.
        return Ok(true); // Assuming link updates were successful if they happened. Or return based on link update results.
                         // For now, let's say if link updates happened, they succeeded or logged errors.
                         // The function should ideally return based on whether the page update SQL runs.
    }


    // Always update the updated_at timestamp if any page field is changing.
    set_clauses.push(format!("updated_at = now()"));

    let query_str = format!(
        "UPDATE pages SET {} WHERE id = $1 RETURNING id",
        set_clauses.join(", ")
    );

    let mut query = sqlx::query(&query_str);
    query = query.bind(id);

    if let Some(t) = title {
        query = query.bind(t);
    }
    // Bind the original content_json Option here
    if let Some(c) = &content_json { // content_json here is the Option passed to the function
        query = query.bind(c);
    }
    if let Some(rm) = raw_markdown {
        match rm {
            Some(val) => query = query.bind(val),
            None => query = query.bind(Option::<&str>::None),
        }
    }

    let result = query.execute(pool).await?;
    Ok(result.rows_affected() > 0)
}


// Placeholder for get_page_by_title - to be implemented as per Step 4
pub async fn get_page_by_title(pool: &PgPool, title: &str) -> Result<Option<Page>, DalError> {
    let page = sqlx::query_as!(
        Page,
        r#"
        SELECT id, title, content_json, raw_markdown, created_at, updated_at
        FROM pages
        WHERE title = $1
        "#,
        title
    )
    .fetch_optional(pool)
    .await
    .map_err(DalError::from)?; // Convert sqlx::Error to DalError

    Ok(page)
}


// New private function to extract links and references
fn extract_links_references_and_blocks(
    content_json: &Value,
    current_page_id: Uuid,
) -> (Vec<ParsedPageLink>, Vec<ParsedBlockReference>, Vec<ExtractedBlockInfo>) {
    let mut page_links = Vec::new();
    let mut block_references = Vec::new();
    let mut extracted_blocks = std::collections::HashSet::new(); // Use HashSet to store unique blocks

    // Helper recursive function to traverse the JSON
    fn traverse_json(
        node: &Value,
        current_parent_block_id: Option<Uuid>, // ID of the immediate parent Lexical node if it's a block
        page_links: &mut Vec<ParsedPageLink>,
        block_references: &mut Vec<ParsedBlockReference>,
        extracted_blocks: &mut std::collections::HashSet<ExtractedBlockInfo>,
        current_page_id: Uuid,
    ) {
        if let Some(obj) = node.as_object() {
            let mut current_block_unique_id: Option<Uuid> = None;
            let mut current_block_type: Option<String> = None;

            if let Some(id_str) = obj.get("uniqueID").and_then(|v| v.as_str()) {
                if let Ok(id) = Uuid::parse_str(id_str) {
                    current_block_unique_id = Some(id);
                    current_block_type = obj.get("type").and_then(|v| v.as_str()).map(String::from);

                    extracted_blocks.insert(ExtractedBlockInfo {
                        id,
                        block_type: current_block_type.clone(),
                        parent_block_id: current_parent_block_id,
                    });
                }
            }

            // Determine the parent_id for children of this node.
            // If this node is a block (has uniqueID), it's the parent for its direct children.
            // Otherwise, children inherit the parent_id from this node's level.
            let parent_id_for_children = current_block_unique_id.or(current_parent_block_id);

            if let Some(node_type_str) = obj.get("type").and_then(|v| v.as_str()) {
                if node_type_str == "text" {
                    if let Some(text_content) = obj.get("text").and_then(|v| v.as_str()) {
                    if let Some(text_content) = obj.get("text").and_then(|v| v.as_str()) {
                        // Page links
                        for cap in PAGE_LINK_REGEX.captures_iter(text_content) {
                            let content = cap[1].trim().to_string();
                            if let Ok(target_uuid) = Uuid::parse_str(&content) {
                                page_links.push(ParsedPageLink { source_page_id: current_page_id, target_id: Some(target_uuid), target_title: None });
                            } else {
                                page_links.push(ParsedPageLink { source_page_id: current_page_id, target_id: None, target_title: Some(content) });
                            }
                        }

                        // Block references
                        // The referencing_block_id is the parent block that contains this text node.
                        if let Some(referencing_id) = parent_id_for_children { // Must be text within a block with uniqueID
                            for cap in BLOCK_REF_REGEX.captures_iter(text_content) {
                                if let Ok(referenced_b_id) = Uuid::parse_str(cap[1].trim()) {
                                    block_references.push(ParsedBlockReference {
                                        source_page_id: current_page_id,
                                        referencing_block_id: referencing_id,
                                        referenced_block_id: referenced_b_id,
                                    });
                                }
                            }
                        }
                    }
                }
                // Other node types (like "link" or custom elements) could also contain text or be blocks themselves.
                // If a "link" node type also has a uniqueID, it would have been captured as a block above.
                // Its children would then be processed.
            }

            // Recursively traverse children, passing the determined parent_id_for_children
            if let Some(children) = obj.get("children").and_then(|v| v.as_array()) {
                for child in children {
                    traverse_json(child, parent_id_for_children, page_links, block_references, extracted_blocks, current_page_id);
                }
            }
        } else if let Some(arr) = node.as_array() {
            for item in arr {
                traverse_json(item, current_parent_block_id, page_links, block_references, extracted_blocks, current_page_id);
            }
        }
    }

    if let Some(root) = content_json.get("root") {
        traverse_json(root, None, &mut page_links, &mut block_references, &mut extracted_blocks, current_page_id);
    } else {
        traverse_json(content_json, None, &mut page_links, &mut block_references, &mut extracted_blocks, current_page_id);
    }

    (page_links, block_references, extracted_blocks.into_iter().collect())
}


pub async fn delete_page(pool: &PgPool, id: Uuid) -> Result<bool, DalError> {
    let result = sqlx::query!(
        r#"
        DELETE FROM pages
        WHERE id = $1
        "#,
        id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn search_pages(pool: &PgPool, query_term: &str) -> Result<Vec<Page>, DalError> {
    let search_pattern = format!("%{}%", query_term);

    let pages = sqlx::query_as!(
        Page,
        r#"
        SELECT id, title, content_json, raw_markdown, created_at, updated_at
        FROM pages
        WHERE title ILIKE $1  -- Case-insensitive search for title
        -- For searching in JSONB:
        -- OR content_json::text ILIKE $1
        -- (This is a simple text search in JSON, more advanced JSONB operators can be used)
        ORDER BY updated_at DESC
        "#,
        search_pattern
    )
    .fetch_all(pool)
    .await?;

    Ok(pages)
}
