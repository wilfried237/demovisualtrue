"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Search, Filter, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SolutionConfiguration } from "@/app/type/types";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";

export const SolutionConfigurationPages = ({ solutions }: { solutions: SolutionConfiguration[] }) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(false);

  // Store fetched names for all entity types
  const [namesById, setNamesById] = useState<Record<string, string>>({});
  const [fetchedIds, setFetchedIds] = useState<Set<string>>(new Set());

  // Extract unique IDs across all entity types
  const uniqueIds = useMemo(() => {
    const ids = { industry: new Set<string>(), technology: new Set<string>(), user: new Set<string>() };
    solutions.forEach(s => {
      if (s.industry_id) ids.industry.add(s.industry_id);
      if (s.technology_id) ids.technology.add(s.technology_id);
      if (s.created_by) ids.user.add(s.created_by);
    });
      return {
      industry: [...ids.industry],
      technology: [...ids.technology],
      user: [...ids.user]
    };
  }, [solutions]);

  // Fetch entity name (generic)
  const fetchEntityName = async (type: string, id: string) => {
    try {
      const res = await fetch(`/api/${type}?id=${encodeURIComponent(id)}`);
      if (!res.ok) return [id, id];
      const data = await res.json();
      const val = type === "user"
        ? data?.company_name ||
          (data?.first_name && data?.last_name
            ? `${data.first_name} ${data.last_name}`
            : data?.first_name) ||
          data?.username ||
          data?.email
        : data?.[type]?.name || data?.name;
      return [id, val || id];
    } catch {
      return [id, id];
    }
  };

  // Batch fetch entity names when needed
  useEffect(() => {
    const idsToFetch = [
      ...uniqueIds.industry.map(id => ["industry", id] as const),
      ...uniqueIds.technology.map(id => ["technology", id] as const),
      ...uniqueIds.user.map(id => ["user", id] as const)
    ].filter(([_, id]) => !namesById[id] && !fetchedIds.has(id));

    if (!idsToFetch.length) return;
    setLoading(true);
    setFetchedIds(prev => new Set([...prev, ...idsToFetch.map(([, id]) => id)]));

    Promise.all(idsToFetch.map(([type, id]) => fetchEntityName(type, id)))
      .then(results => {
        const newMap: Record<string, string> = {};
        results.forEach(([id, name]) => (newMap[id] = name));
        setNamesById(prev => ({ ...prev, ...newMap }));
      })
      .finally(() => setLoading(false));
  }, [uniqueIds, namesById, fetchedIds]);

  // Filtered solutions
  const filteredSolutions = useMemo(() => {
      const searchLower = searchTerm.toLowerCase();
    return solutions.filter(s => {
      const matchesSearch =
        !searchTerm ||
        s.solution_name.toLowerCase().includes(searchLower) ||
        s.solution_description.toLowerCase().includes(searchLower) ||
        (namesById[s.industry_id]?.toLowerCase().includes(searchLower) ?? false) ||
        (namesById[s.technology_id]?.toLowerCase().includes(searchLower) ?? false);
      const matchesStatus = filterStatus === "all" || s.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [solutions, searchTerm, filterStatus, namesById]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active": return "bg-black text-white";
      case "draft": return "bg-gray-200 text-gray-800";
      case "inactive": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Solution Configurations</h1>
            <p className="mt-2 text-gray-600">Manage and monitor your solution configurations</p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search solutions..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Solutions Grid */}
        {loading ? (
          <div className="text-gray-500 text-center py-12">Loading...</div>
        ) : filteredSolutions.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSolutions.map(solution => (
              <Card
                key={solution._id}
                className="cursor-pointer hover:shadow-lg"
                onClick={() => router.push(`/solution/${solution._id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="line-clamp-1">{solution.solution_name}</CardTitle>
                      <p className="text-sm text-gray-600 line-clamp-2">{solution.solution_description}</p>
                    </div>
                    <ChevronRight className="text-gray-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(solution.status)}`}>
                        {solution.status}
                      </span>
                    <span className="text-xs text-gray-500">{solution.parameters?.length || 0} parameters</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-gray-500">Industry</div>
                      <div>{namesById[solution.industry_id] || solution.industry_id}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Technology</div>
                      <div>{namesById[solution.technology_id] || solution.technology_id}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Created by {namesById[solution.created_by] || solution.created_by} •{" "}
                    {new Date(solution.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No solutions found</div>
        )}
      </div>
    </div>
  );
};
