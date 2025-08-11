import { SolutionConfiguration } from "@/app/type/types";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Zap, User, Clock, Settings, Calculator, Info } from "lucide-react";
import { formatDate } from "@/lib/formatdate";
import { useCallback } from "react";

export const Solution = ({solution, setCurrentPage}: {solution: SolutionConfiguration, setCurrentPage: () => void}) => {
    const getStatusColor = useCallback((status: string) => {
        switch (status?.toLowerCase()) {
          case 'active': return 'bg-black text-white';
          case 'draft': return 'bg-gray-200 text-gray-800';
          case 'inactive': return 'bg-gray-100 text-gray-600';
          default: return 'bg-gray-100 text-gray-600';
        }
      }, []);
    return (
        <div className="min-h-screen bg-white">
          {/* Header */}
          <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setCurrentPage()}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{solution.solution_name}</h1>
                    <p className="text-gray-600">{solution.solution_description}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(solution.status)}`}>
                  {solution.status}
                </span>
              </div>
            </div>
          </div>
  
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="border-gray-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Building className="h-8 w-8 text-gray-700" />
                    <div>
                      <div className="text-sm text-gray-500">Industry</div>
                      <div className="font-semibold text-gray-900">{solution.industry_id}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
  
              <Card className="border-gray-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Zap className="h-8 w-8 text-gray-700" />
                    <div>
                      <div className="text-sm text-gray-500">Technology</div>
                      <div className="font-semibold text-gray-900">{solution.technology_id}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
  
              <Card className="border-gray-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <User className="h-8 w-8 text-gray-700" />
                    <div>
                      <div className="text-sm text-gray-500">Created By</div>
                      <div className="font-semibold text-gray-900">{solution.created_by}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
  
              <Card className="border-gray-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-gray-700" />
                    <div>
                      <div className="text-sm text-gray-500">Created</div>
                      <div className="font-semibold text-gray-900">{new Date(solution.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
  
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Parameters Section */}
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Parameters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {solution.parameters.map((param) => (
                      <div key={param.id} className="border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900">{param.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">{param.description}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900">{param.value}</div>
                            <div className="text-xs text-gray-500">{param.unit}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                          <span className="text-xs text-gray-600">{param.category.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
  
              {/* Calculations Section */}
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Calculations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {solution.calculations.map((calc) => (
                      <div key={calc.id} className="border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900">{calc.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">{calc.description}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900">
                              {typeof calc.result === 'number' ? calc.result.toLocaleString() : calc.result}
                            </div>
                            <div className="text-xs text-gray-500">{calc.units}</div>
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          <div className="text-xs text-gray-500 mb-1">Formula:</div>
                          <code className="text-sm font-mono text-gray-800">{calc.formula}</code>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                            <span className="text-xs text-gray-600">{calc.category.name}</span>
                          </div>
                          <span className="text-xs text-green-600 font-medium">{calc.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
  
            {/* Additional Information */}
            <Card className="mt-8 border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Additional Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Client Information</h4>
                    <div className="text-gray-600">{solution.client_id}</div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Last Updated</h4>
                    <div className="text-gray-600">{formatDate(solution.created_at)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
};
