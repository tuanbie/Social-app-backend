-- =========================================================
-- SOCIAL APP DATABASE SCHEMA (SurrealQL)
-- =========================================================

-- =========================================================
-- 1. NGƯỜI DÙNG (USER)
-- =========================================================
DEFINE TABLE user SCHEMAFULL;
DEFINE FIELD username    ON user TYPE string ASSERT string::len($value) >= 3;
DEFINE FIELD full_name   ON user TYPE string;
DEFINE FIELD email       ON user TYPE string ASSERT string::is_email($value);
DEFINE FIELD password    ON user TYPE string;
DEFINE FIELD avatar      ON user TYPE option<string>;
DEFINE FIELD bio         ON user TYPE option<string>;
DEFINE FIELD status      ON user TYPE string DEFAULT 'ACTIVE' ASSERT $value INSIDE ['ACTIVE', 'BLOCK'];
DEFINE FIELD created_at  ON user TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_user_email ON user COLUMNS email UNIQUE;
DEFINE INDEX idx_user_username ON user COLUMNS username UNIQUE;

-- =========================================================
-- 2. QUAN HỆ BẠN BÈ (FRIEND)
-- =========================================================
DEFINE TABLE friend SCHEMAFULL TYPE RELATION FROM user TO user;
DEFINE FIELD status      ON friend TYPE string DEFAULT 'pending' ASSERT $value INSIDE ['pending', 'accepted', 'blocked'];
DEFINE FIELD created_at  ON friend TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_unique_friend ON friend FIELDS in, out UNIQUE;

-- =========================================================
-- 3. BÀI VIẾT (POST)
-- =========================================================
DEFINE TABLE post SCHEMAFULL;
DEFINE FIELD content     ON post TYPE option<string>;
DEFINE FIELD image       ON post TYPE option<string>;
DEFINE FIELD files       ON post TYPE array<string> DEFAULT [];
DEFINE FIELD author      ON post TYPE record<user>;
DEFINE FIELD status      ON post TYPE string DEFAULT 'published' ASSERT $value INSIDE ['published', 'pending'];
DEFINE FIELD created_at  ON post TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_post_created ON post FIELDS created_at;

-- =========================================================
-- 4. TƯƠNG TÁC LIKE (LIKE)
-- =========================================================
DEFINE TABLE like SCHEMAFULL TYPE RELATION FROM user TO post;
DEFINE FIELD created_at  ON like TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_unique_like ON like FIELDS in, out UNIQUE;

-- =========================================================
-- 5. BÌNH LUẬN (COMMENT)
-- =========================================================
DEFINE TABLE comment SCHEMAFULL;
DEFINE FIELD content     ON comment TYPE string ASSERT string::len($value) > 0;
DEFINE FIELD author      ON comment TYPE record<user>;
DEFINE FIELD image       ON comment TYPE option<string>;
DEFINE FIELD target      ON comment TYPE record<post | comment>;
DEFINE FIELD created_at  ON comment TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_comment_target ON comment FIELDS target;

-- =========================================================
-- 6. TIN NHẮN (MESSAGE)
-- =========================================================
DEFINE TABLE message SCHEMAFULL;
DEFINE FIELD sender      ON message TYPE record<user>;
DEFINE FIELD receiver    ON message TYPE record<user>;
DEFINE FIELD content     ON message TYPE string;
DEFINE FIELD attachments ON message TYPE array<string> DEFAULT [];
DEFINE FIELD is_read     ON message TYPE bool DEFAULT false;
DEFINE FIELD is_revoked  ON message TYPE bool DEFAULT false;
DEFINE FIELD created_at  ON message TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_message_time ON message FIELDS created_at;

