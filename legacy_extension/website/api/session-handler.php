<?php
session_start([
    'cookie_lifetime' => 86400,
    'cookie_secure' => true,
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax'
]);

header('Access-Control-Allow-Origin: https://alikhan.studio');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $_SESSION['user_email'] = $data['email'];
    echo json_encode(['status' => 'success', 'email' => $data['email']]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'status' => isset($_SESSION['user_email']) ? 'success' : 'error',
        'email' => $_SESSION['user_email'] ?? null
    ]);
    exit;
}
