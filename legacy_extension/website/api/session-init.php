<?php
session_start();
header('Access-Control-Allow-Origin: https://alikhan.studio');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (!empty($data['email'])) {
    $_SESSION['user_email'] = $data['email'];
    echo json_encode(['status' => 'success']);
    exit;
}

http_response_code(400);
echo json_encode(['status' => 'error', 'message' => 'Invalid request']);
