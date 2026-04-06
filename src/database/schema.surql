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
-- 2. CHẶN (BLOCK) — tách khỏi friend
-- =========================================================
DEFINE TABLE block SCHEMAFULL TYPE RELATION FROM user TO user;
DEFINE FIELD in  ON block TYPE record<user>;
DEFINE FIELD out ON block TYPE record<user>;

DEFINE INDEX idx_unique_block ON block FIELDS in, out UNIQUE;

-- =========================================================
-- 3. QUAN HỆ BẠN BÈ (FRIEND)
-- =========================================================
DEFINE TABLE friend SCHEMAFULL TYPE RELATION FROM user TO user;
DEFINE FIELD status      ON friend TYPE string DEFAULT 'pending' ASSERT $value INSIDE ['pending', 'accepted', 'declined'];
DEFINE FIELD created_at  ON friend TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at  ON friend TYPE datetime VALUE time::now();

DEFINE INDEX idx_unique_friend ON friend FIELDS in, out UNIQUE;

-- =========================================================
-- 4. BÀI VIẾT (POST)
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
-- 5. TƯƠNG TÁC LIKE (LIKE) — một dòng / post, danh sách user trong liker_ids
-- =========================================================
DEFINE TABLE like SCHEMAFULL;
DEFINE FIELD post_id    ON like TYPE record<post>;
DEFINE FIELD liker_ids  ON like TYPE array<record<user>> DEFAULT [];
DEFINE FIELD updated_at ON like TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_like_post ON like FIELDS post_id UNIQUE;

-- =========================================================
-- 6. BÌNH LUẬN (COMMENT)
-- =========================================================
DEFINE TABLE comment SCHEMAFULL;
DEFINE FIELD content     ON comment TYPE string;
DEFINE FIELD author      ON comment TYPE record<user>;
DEFINE FIELD post_id     ON comment TYPE record<post>;
DEFINE FIELD parent      ON comment TYPE none | record<comment> DEFAULT NONE;
DEFINE FIELD created_at  ON comment TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_created ON comment FIELDS created_at;
DEFINE INDEX idx_parent ON comment FIELDS parent;
DEFINE INDEX idx_post ON comment FIELDS post_id;

-- =========================================================
-- 7. TIN NHẮN (MESSAGE)
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

-- =========================================================
-- 8. THÔNG BÁO (NOTIFICATION)
-- =========================================================
DEFINE TABLE notification SCHEMAFULL;
DEFINE FIELD receiver    ON notification TYPE record<user>;
DEFINE FIELD actor       ON notification TYPE record<user>;
DEFINE FIELD action      ON notification TYPE string ASSERT $value INSIDE ['LIKE', 'COMMENT', 'FRIEND_REQ', 'FRIEND_ACCEPT'];
DEFINE FIELD target_id   ON notification TYPE record;
DEFINE FIELD is_read     ON notification TYPE bool DEFAULT false;
DEFINE FIELD created_at  ON notification TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_notification_receiver_created ON notification FIELDS receiver, created_at;

