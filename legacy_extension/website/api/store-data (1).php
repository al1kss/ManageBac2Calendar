<?php
session_start([
    'cookie_lifetime' => 86400,
    'cookie_secure' => true,
    'cookie_httponly' => true,
    'cookie_samesite' => 'None',
    'use_strict_mode' => true
]);

header('Access-Control-Allow-Origin: https://alikhan.studio');
header('Access-Control-Allow-Credentials: true');
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: chrome-extension://filfdiekmfbhphcbbbdhkahjoggifjnj');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 86400');
    exit(0);
}

// Set response headers
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Origin: chrome-extension://filfdiekmfbhphcbbbdhkahjoggifjnj');
header('Content-Type: application/json');

try {
    // Get input data
    $json = file_get_contents('php://input');
    if (!$json) {
        throw new Exception('No input data received');
    }

    $data = json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON input');
    }

    // Validate email
    if (!isset($data['email']) || !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Invalid email format');
    }

    // Validate data structure
    if (!isset($data['data']) || !is_array($data['data'])) {
        throw new Exception('Invalid data format');
    }

    // Store data
    $filename = 'storage/' . md5($data['email']) . '.json';
    $existingData = file_exists($filename) ? json_decode(file_get_contents($filename), true) : [];

    if (!is_array($existingData)) {
        $existingData = [];
    }

    $combinedData = array_merge($existingData, $data['data']);
    if (file_put_contents($filename, json_encode($combinedData, JSON_PRETTY_PRINT))) {
        echo json_encode([
            'status' => 'success',
            'count' => count($combinedData)
        ]);
    } else {
        throw new Exception('Failed to save data');
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
