-- AUTO-GENERATED FROM CONNECTED SURREALDB
-- Generated at: 2026-03-25T16:59:08.432Z

-- ------------------------------
-- OPTION
-- ------------------------------

OPTION IMPORT;

-- ------------------------------
-- TABLE: block
-- ------------------------------

DEFINE TABLE block TYPE RELATION IN user OUT user SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD in ON block TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD out ON block TYPE record<user> PERMISSIONS FULL;

DEFINE INDEX idx_unique_block ON block FIELDS in, out UNIQUE;


-- ------------------------------
-- TABLE: comment
-- ------------------------------

DEFINE TABLE comment TYPE NORMAL SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD author ON comment TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD content ON comment TYPE string PERMISSIONS FULL;
DEFINE FIELD created_at ON comment TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD parent ON comment TYPE none | record<comment> DEFAULT NONE PERMISSIONS FULL;
DEFINE FIELD post_id ON comment TYPE record<post> PERMISSIONS FULL;

DEFINE INDEX idx_created ON comment FIELDS created_at;
DEFINE INDEX idx_parent ON comment FIELDS parent;
DEFINE INDEX idx_post ON comment FIELDS post_id;


-- ------------------------------
-- TABLE: conversation
-- ------------------------------

DEFINE TABLE conversation TYPE NORMAL SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD participants ON conversation TYPE array<record<user>> ASSERT array::len($value) == 2 PERMISSIONS FULL;
DEFINE FIELD participants.* ON conversation TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD updated_at ON conversation TYPE datetime DEFAULT time::now() PERMISSIONS FULL;

DEFINE INDEX idx_participants ON conversation FIELDS participants;
DEFINE INDEX idx_updated_at ON conversation FIELDS updated_at;


-- ------------------------------
-- TABLE: friend
-- ------------------------------

DEFINE TABLE friend TYPE RELATION IN user OUT user SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD created_at ON friend TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD in ON friend TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD out ON friend TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD status ON friend TYPE string DEFAULT 'pending' ASSERT $value INSIDE ['pending', 'accepted', 'declined'] PERMISSIONS FULL;
DEFINE FIELD updated_at ON friend TYPE datetime VALUE time::now() PERMISSIONS FULL;



-- ------------------------------
-- TABLE: like
-- ------------------------------

DEFINE TABLE like TYPE NORMAL SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD created_at ON like TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD in ON like TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD liker_ids ON like TYPE array<record<user>> DEFAULT [] PERMISSIONS FULL;
DEFINE FIELD liker_ids.* ON like TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD out ON like TYPE record<post> PERMISSIONS FULL;
DEFINE FIELD post_id ON like TYPE record<post> PERMISSIONS FULL;
DEFINE FIELD updated_at ON like TYPE datetime DEFAULT time::now() PERMISSIONS FULL;

DEFINE INDEX idx_like_post ON like FIELDS post_id UNIQUE;
DEFINE INDEX idx_unique_like ON like FIELDS in, out UNIQUE;


-- ------------------------------
-- TABLE: message
-- ------------------------------

DEFINE TABLE message TYPE NORMAL SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD content ON message TYPE string PERMISSIONS FULL;
DEFINE FIELD conversation ON message TYPE record<conversation> PERMISSIONS FULL;
DEFINE FIELD created_at ON message TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD sender ON message TYPE record<user> PERMISSIONS FULL;

DEFINE INDEX idx_conv_time ON message FIELDS conversation, created_at;


-- ------------------------------
-- TABLE: notification
-- ------------------------------

DEFINE TABLE notification TYPE NORMAL SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD action ON notification TYPE string ASSERT $value INSIDE ['LIKE', 'COMMENT', 'FRIEND_REQ'] PERMISSIONS FULL;
DEFINE FIELD actor ON notification TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD created_at ON notification TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD is_read ON notification TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD receiver ON notification TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD target_id ON notification TYPE record PERMISSIONS FULL;



-- ------------------------------
-- TABLE: post
-- ------------------------------

DEFINE TABLE post TYPE NORMAL SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD author ON post TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD comment_count ON post TYPE int DEFAULT 0 PERMISSIONS FULL;
DEFINE FIELD content ON post TYPE none | string PERMISSIONS FULL;
DEFINE FIELD created_at ON post TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD files ON post TYPE array<string> DEFAULT [] PERMISSIONS FULL;
DEFINE FIELD files.* ON post TYPE string PERMISSIONS FULL;
DEFINE FIELD image ON post TYPE none | string PERMISSIONS FULL;
DEFINE FIELD like_count ON post TYPE int DEFAULT 0 PERMISSIONS FULL;
DEFINE FIELD status ON post TYPE string DEFAULT 'published' ASSERT $value INSIDE ['published', 'pending'] PERMISSIONS FULL;

DEFINE INDEX idx_post_created ON post FIELDS created_at;


-- ------------------------------
-- TABLE: seen
-- ------------------------------

DEFINE TABLE seen TYPE RELATION IN user OUT post SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD created_at ON seen TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD in ON seen TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD out ON seen TYPE record<post> PERMISSIONS FULL;
DEFINE FIELD seen_post_ids ON seen TYPE array<record<post>> DEFAULT [] PERMISSIONS FULL;
DEFINE FIELD seen_post_ids.* ON seen TYPE record<post> PERMISSIONS FULL;
DEFINE FIELD user_id ON seen TYPE record<user> PERMISSIONS FULL;



-- ------------------------------
-- TABLE: user
-- ------------------------------

DEFINE TABLE user TYPE NORMAL SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD avatar ON user TYPE none | string PERMISSIONS FULL;
DEFINE FIELD bio ON user TYPE none | string PERMISSIONS FULL;
DEFINE FIELD created_at ON user TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD email ON user TYPE string ASSERT string::is_email($value) PERMISSIONS FULL;
DEFINE FIELD full_name ON user TYPE string PERMISSIONS FULL;
DEFINE FIELD password ON user TYPE string PERMISSIONS FULL;
DEFINE FIELD profile ON user TYPE object DEFAULT {  } PERMISSIONS FULL;
DEFINE FIELD profile.address ON user TYPE none | string PERMISSIONS FULL;
DEFINE FIELD profile.avatar ON user TYPE none | string PERMISSIONS FULL;
DEFINE FIELD profile.gender ON user TYPE none | string ASSERT $value INSIDE [NONE, 'MALE', 'FEMALE', 'OTHER'] PERMISSIONS FULL;
DEFINE FIELD profile.phone ON user TYPE none | string PERMISSIONS FULL;
DEFINE FIELD status ON user TYPE string DEFAULT 'ACTIVE' ASSERT $value INSIDE ['ACTIVE', 'BLOCK'] PERMISSIONS FULL;
DEFINE FIELD username ON user TYPE string ASSERT string::len($value) >= 3 PERMISSIONS FULL;

DEFINE INDEX idx_user_email ON user FIELDS email UNIQUE;
DEFINE INDEX idx_user_username ON user FIELDS username UNIQUE;


-- ------------------------------
-- TABLE: user_in_conv
-- ------------------------------

DEFINE TABLE user_in_conv TYPE RELATION IN user OUT conversation SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD in ON user_in_conv TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD last_read_at ON user_in_conv TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD out ON user_in_conv TYPE record<conversation> PERMISSIONS FULL;




