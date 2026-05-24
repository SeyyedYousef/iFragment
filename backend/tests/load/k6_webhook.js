import http from 'k6/http';
import { check, sleep } from 'k6';

// 10k concurrent webhooks load test configuration
export const options = {
    stages: [
        { duration: '10s', target: 200 },  // Ramp up to 200 VUs
        { duration: '30s', target: 1000 }, // Scale up to 1000 VUs shooting 10k+ total requests
        { duration: '10s', target: 0 },    // Ramp down to 0
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
        http_req_failed: ['rate<0.01'],    // Under 1% failure rate
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8080/api/v1';
const MOCK_BOT_ID = __ENV.BOT_ID || '00000000-0000-0000-0000-000000000000'; // Replace with a test bot ID

export default function () {
    // Produce randomized update ID to bypass sliding-window Redis idempotency checks
    const randomUpdateID = Math.floor(Math.random() * 100000000) + 1;
    const randomChatID = -1001000000000 - Math.floor(Math.random() * 100000);

    const payload = JSON.stringify({
        update_id: randomUpdateID,
        channel_post: {
            message_id: Math.floor(Math.random() * 10000),
            chat: {
                id: randomChatID,
                type: 'channel',
                title: 'Load Test Channel',
            },
            date: Math.floor(Date.now() / 1000), // Fresh date to pass S5 Replay check
            text: 'Hello from k6 load test! #loadtest keyword',
        },
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': __ENV.WEBHOOK_SECRET_TOKEN || 'test-secret-token',
        },
    };

    const res = http.post(`${BASE_URL}/webhook/telegram/${MOCK_BOT_ID}`, payload, params);

    check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 200ms': (r) => r.timings.duration < 200,
    });

    sleep(0.1); // Concurrency sleep interval
}
