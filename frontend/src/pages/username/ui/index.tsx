import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface ValuationResult {
    username?: string; // might not be returned in /valuate directly
    base_price_ton: string;
    expected_ton: string;
    low_ton: string;
    high_ton: string;
    confidence_score: number;
    rarity: number;
    reasoning_log: Record<string, any>;
}

export const UsernamePage: React.FC = () => {
    const { username } = useParams<{ username: string }>();
    const [data, setData] = useState<ValuationResult | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchValuation = async () => {
            if (!username) return;
            try {
                setLoading(true);
                const res = await fetch(`http://localhost:8080/api/v1/usernames/valuate?u=${username}`);
                if (!res.ok) throw new Error('Failed to fetch valuation');
                const result = await res.json();
                setData(result);
            } catch (err: any) {
                setError(err.message || 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchValuation();
    }, [username]);

    if (loading) return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Loading...</div>;
    if (error) return <div className="flex justify-center items-center h-screen bg-gray-900 text-red-500">{error}</div>;
    if (!data) return null;

    // Decimal amounts from backend come as strings
    const lowTON = parseFloat(data.low_ton || '0');
    const expectedTON = parseFloat(data.expected_ton || '0');
    const highTON = parseFloat(data.high_ton || '0');

    // Assume 1 TON = $5.00 for mockup (could be fetched)
    const tonPrice = 5.0;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
            <h1 className="text-4xl font-bold mb-8 text-blue-400">@{username}</h1>
            
            <div className="bg-gray-800 rounded-xl p-8 shadow-2xl w-full max-w-2xl border border-gray-700">
                <h2 className="text-2xl font-semibold mb-6 border-b border-gray-700 pb-2">Valuation Estimate</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-center">
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">Low Range</p>
                        <p className="text-2xl font-bold text-gray-200">{lowTON.toLocaleString()} TON</p>
                        <p className="text-sm text-gray-500">${(lowTON * tonPrice).toLocaleString()}</p>
                    </div>
                    
                    <div className="bg-blue-600 p-4 rounded-lg transform scale-105 shadow-lg border border-blue-400">
                        <p className="text-sm text-blue-200 uppercase tracking-wider mb-1">Expected Price</p>
                        <p className="text-3xl font-bold text-white">{expectedTON.toLocaleString()} TON</p>
                        <p className="text-sm text-blue-200">${(expectedTON * tonPrice).toLocaleString()}</p>
                    </div>
                    
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">High Range</p>
                        <p className="text-2xl font-bold text-gray-200">{highTON.toLocaleString()} TON</p>
                        <p className="text-sm text-gray-500">${(highTON * tonPrice).toLocaleString()}</p>
                    </div>
                </div>

                <div className="flex justify-between items-center bg-gray-900 rounded-lg p-4">
                    <div>
                        <p className="text-sm text-gray-400">Confidence Score</p>
                        <p className="text-xl font-bold text-green-400">
                            {typeof data.confidence_score === 'number' ? data.confidence_score.toFixed(1) : data.confidence_score} / 100
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-400">Rarity Tier</p>
                        <p className="text-xl font-bold text-blue-400">{data.rarity}</p>
                    </div>
                </div>
            </div>
        </div>
        </div>
    );
};

export default UsernamePage;
