"use client"

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Search, Filter, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SolutionConfiguration } from '@/app/type/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

export const SolutionConfigurationPages = ({ solutions }: { solutions: SolutionConfiguration[]}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [industryNamesById, setIndustryNamesById] = useState<Record<string, string>>({});
  const [technologyNamesById, setTechnologyNamesById] = useState<Record<string, string>>({});
  const [userNamesById, setUserNamesById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useRouter();
  const [fetchedIds, setFetchedIds] = useState({
    industries: new Set<string>(),
    technologies: new Set<string>(),
    users: new Set<string>()
  });

  // Memoize unique IDs to prevent recalculation on every render
  const uniqueIds = useMemo(() => {
    if (!solutions || solutions.length === 0) {
      return {
        industryIds: [],
        technologyIds: [],
        userIds: []
      };
    }

    const industryIds = Array.from(new Set(solutions.map(s => s.industry_id).filter(Boolean)));
    const technologyIds = Array.from(new Set(solutions.map(s => s.technology_id).filter(Boolean)));
    const userIds = Array.from(new Set(solutions.map(s => s.created_by).filter(Boolean)));

    return { industryIds, technologyIds, userIds };
  }, [solutions]);

  // Generic fetch function with better error handling and caching
  const fetchEntityName = useCallback(async (
    type: 'industry' | 'technology' | 'user',
    id: string
  ): Promise<[string, string]> => {
    try {
      const response = await fetch(`/api/${type}?id=${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`Failed to fetch ${type} ${id}: ${response.status} ${response.statusText}`);
        return [id, id]; // Fallback to ID
      }

      const data = await response.json();
      
      let name = id; // Default fallback
      
      if (type === 'user') {
        // Handle user data structure with company_name or first_name
        const userData = data?.user || data?.data || data?.result || data;
        console.log(userData);
        name = userData?.company_name || 
               (userData?.first_name && userData?.last_name ? `${userData.first_name} ${userData.last_name}` : userData?.first_name) || 
               userData?.name ||
               userData?.username ||
               userData?.email ||
               id;
      } else {
        // Handle industry and technology data
        name = data?.[type]?.name || 
               data?.name || 
               data?.result?.name || 
               data?.data?.name ||
               id;
      }

      return [id, name];
    } catch (error) {
      console.error(`Error fetching ${type} ${id}:`, error);
      return [id, id]; // Fallback to ID
    }
  }, []);

  // Optimized data fetching with proper cleanup and caching
  useEffect(() => {
    let isCancelled = false;
    
    // Determine which IDs need to be fetched (not already cached or in progress)
    const industryIdsToFetch = uniqueIds.industryIds.filter(
      id => !industryNamesById[id] && !fetchedIds.industries.has(id)
    );
    const technologyIdsToFetch = uniqueIds.technologyIds.filter(
      id => !technologyNamesById[id] && !fetchedIds.technologies.has(id)
    );
    const userIdsToFetch = uniqueIds.userIds.filter(
      id => !userNamesById[id] && !fetchedIds.users.has(id)
    );

    // If nothing to fetch, exit early
    if (industryIdsToFetch.length === 0 && 
        technologyIdsToFetch.length === 0 && 
        userIdsToFetch.length === 0) {
      return;
    }

    setLoading(true);

    // Mark IDs as being fetched to prevent duplicate requests
    setFetchedIds(prev => ({
      industries: new Set([...prev.industries, ...industryIdsToFetch]),
      technologies: new Set([...prev.technologies, ...technologyIdsToFetch]),
      users: new Set([...prev.users, ...userIdsToFetch])
    }));

    const fetchAllData = async () => {
      try {
        // Fetch all data in parallel with proper batching
        const [industryResults, technologyResults, userResults] = await Promise.allSettled([
          Promise.all(industryIdsToFetch.map(id => fetchEntityName('industry', id))),
          Promise.all(technologyIdsToFetch.map(id => fetchEntityName('technology', id))),
          Promise.all(userIdsToFetch.map(id => fetchEntityName('user', id)))
        ]);

        if (isCancelled) return;

        // Process industry results
        if (industryResults.status === 'fulfilled') {
          const industryMap: Record<string, string> = {};
          industryResults.value.forEach(([id, name]) => {
            industryMap[id] = name;
          });
          setIndustryNamesById(prev => ({ ...prev, ...industryMap }));
        }

        // Process technology results
        if (technologyResults.status === 'fulfilled') {
          const technologyMap: Record<string, string> = {};
          technologyResults.value.forEach(([id, name]) => {
            technologyMap[id] = name;
          });
          setTechnologyNamesById(prev => ({ ...prev, ...technologyMap }));
        }

        // Process user results
        if (userResults.status === 'fulfilled') {
          const userMap: Record<string, string> = {};
          userResults.value.forEach(([id, name]) => {
            userMap[id] = name;
          });
          setUserNamesById(prev => ({ ...prev, ...userMap }));
        }

      } catch (error) {
        console.error('Error fetching entity names:', error);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchAllData();

    return () => {
      isCancelled = true;
    };
  }, [uniqueIds, fetchEntityName]); // Removed the problematic dependencies

  // Memoize filtered solutions to prevent recalculation
  const filteredSolutions = useMemo(() => {
    if (!solutions) return [];
    
    return solutions.filter(solution => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        solution.solution_name.toLowerCase().includes(searchLower) ||
        solution.solution_description.toLowerCase().includes(searchLower) ||
        solution.industry_id.toLowerCase().includes(searchLower) ||
        (industryNamesById[solution.industry_id]?.toLowerCase().includes(searchLower)) ||
        (technologyNamesById[solution.technology_id]?.toLowerCase().includes(searchLower));
      
      const matchesFilter = filterStatus === 'all' || solution.status === filterStatus;
      
      return matchesSearch && matchesFilter;
    });
  }, [solutions, searchTerm, filterStatus, industryNamesById, technologyNamesById]);

  // Helper: detect if event originated from an interactive element
  const isInteractiveElement = useCallback((el: HTMLElement | null): boolean => {
    if (!el) return false;
    return !!el.closest('button, a, input, select, textarea, label, [role="button"], [role="link"], [contenteditable="true"]');
  }, []);

  const handleSolutionClick = useCallback((solution: SolutionConfiguration) => {
    navigate.push(`/solution/${solution._id}`);
  }, []);

  // Memoize formatting functions
  const formatDate = useCallback((dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-black text-white';
      case 'draft': return 'bg-gray-200 text-gray-800';
      case 'inactive': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  }, []);

  // Memoize skeleton cards
  const SkeletonCard = React.memo(() => (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-5 w-5 bg-gray-200 rounded-full animate-pulse ml-2" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-3 w-56 bg-gray-200 rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  ));

  // Handle search with debouncing (optional enhancement)
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">Solution Configurations</h1>
            <p className="mt-2 text-gray-600">Manage and monitor your solution configurations</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search solutions..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select
              value={filterStatus}
              onValueChange={setFilterStatus}
            >
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSolutions.map((solution) => (
              <Card
                key={solution._id}
                className="relative cursor-pointer hover:shadow-lg transition-shadow duration-200 border-gray-200"
                onClick={(e) => {
                  if (isInteractiveElement(e.target as HTMLElement)) return;
                  handleSolutionClick(solution);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if (isInteractiveElement(e.target as HTMLElement)) return;
                    e.preventDefault();
                    handleSolutionClick(solution);
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-1">
                        {solution.solution_name}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {solution.solution_description}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(solution.status)}`}>
                        {solution.status}
                      </span>
                      <div className="text-xs text-gray-500">
                        {solution.parameters?.length || 0} parameters
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-gray-500">Industry</div>
                        <div className="font-medium text-gray-900" title={industryNamesById[solution.industry_id] || solution.industry_id}>
                          {industryNamesById[solution.industry_id] || solution.industry_id}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Technology</div>
                        <div className="font-medium text-gray-900" title={technologyNamesById[solution.technology_id] || solution.technology_id}>
                          {technologyNamesById[solution.technology_id] || solution.technology_id}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500">
                      Created by {userNamesById[solution.created_by] || solution.created_by} • {formatDate(solution.created_at?.toString() || '')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && filteredSolutions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              {searchTerm || filterStatus !== 'all' 
                ? 'No solutions found matching your criteria' 
                : 'No solutions available'
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
};