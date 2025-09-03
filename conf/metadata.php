<?php
/**
 * Plugin configuration file for kanban plugin
 */

$meta['default_editable'] = array('onoff');
$meta['default_sortable'] = array('onoff');
$meta['auto_save'] = array('onoff');
$meta['max_columns'] = array('numeric');
$meta['max_cards_per_column'] = array('numeric');

// SECURITY: Authentication and permissions
$meta['enable_fallback_auth'] = array('onoff');
$meta['require_auth'] = array('onoff');
$meta['log_security_events'] = array('onoff');
$meta['max_lock_time'] = array('numeric');
