"use client";

import { SolutionConfiguration } from "@/app/type/types";
import { useState, useEffect, use } from "react";
import { Solution } from "./component/solution";

export default function SolutionPage({ params }: { params: Promise<{ solutionId: string }> }) {
    const { solutionId } = use(params); 
    const [loading, setLoading] = useState(true);
    const [solution, setSolution] = useState<SolutionConfiguration | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSolution = async () => {
            if (!solutionId) {
                setError("No solution ID provided");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                
                const response = await fetch(`/api/formulas/${solutionId}`);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch solution: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                setSolution(data);
            } catch (error) {
                console.error("Error fetching solution:", error);
                setError(error instanceof Error ? error.message : "Failed to fetch solution");
            } finally {
                setLoading(false);
            }
        };

        fetchSolution();
    }, [solutionId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading solution...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
                    <p className="text-gray-600">{error}</p>
                    <button 
                        onClick={() => window.history.back()} 
                        className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!solution) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-gray-600 text-lg">Solution not found</div>
                    <button 
                        onClick={() => window.history.back()} 
                        className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return <Solution solution={solution} setCurrentPage={() => {}} />;
}
