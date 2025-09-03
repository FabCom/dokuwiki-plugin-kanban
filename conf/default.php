<?php
/**
 * Default configuration settings for kanban plugin
 */

$conf['default_editable'] = 1;
$conf['default_sortable'] = 1;
$conf['auto_save'] = 1;
$conf['max_columns'] = 10;
$conf['max_cards_per_column'] = 50;

// SECURITY: Authentication and permissions
$conf['enable_fallback_auth'] = 0;  // NEVER enable in production
$conf['require_auth'] = 1;          // Require authentication for write operations
$conf['log_security_events'] = 1;   // Log security events
$conf['max_lock_time'] = 900;       // Lock timeout in seconds (15 minutes)
