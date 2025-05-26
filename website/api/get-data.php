<?php
session_start();
header('Access-Control-Allow-Origin: https://alikhan.studio');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

try {
    // Validate session
    if (!isset($_SESSION['user_email'])) {
        throw new Exception('Unauthorized', 401);
    }

    $requestedEmail = $_GET['email'] ?? '';
    if ($_SESSION['user_email'] !== $requestedEmail) {
        throw new Exception('Forbidden', 403);
    }

    $filename = 'storage/' . md5($requestedEmail) . '.json';
    
    if (!file_exists($filename)) {
        echo json_encode(['status' => 'success', 'data' => []]);
        exit;
    }

    $data = json_decode(file_get_contents($filename), true);
    
    echo json_encode([
        'status' => 'success',
        'data' => $data,
        'count' => count($data)
    ]);

} catch (Exception $e) {
    http_response_code($e->getCode() ?: 500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
