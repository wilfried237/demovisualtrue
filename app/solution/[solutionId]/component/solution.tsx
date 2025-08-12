"use client";

import { SolutionConfiguration } from "@/app/type/types";
import { ArrowLeft, Building, Zap, User, Clock, Settings, Calculator, Info, TrendingUp, X, Maximize2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatdate";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

export const Solution = ({
  solution,
  setCurrentPage
}: {
  solution: SolutionConfiguration;
  setCurrentPage: () => void;
}) => {
  const navigate = useRouter();
  const [namesById, setNamesById] = useState<Record<string, string>>({});

  const getStatusColor = useCallback((status: string) => {
    switch (status?.toLowerCase()) {
      case "active": return "bg-black text-white";
      case "draft": return "bg-gray-200 text-gray-800";
      case "inactive": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-600";
    }
  }, []);

  // Generic fetch for entity names
  const fetchEntityName = async (type: string, id: string) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/${type}?id=${encodeURIComponent(id)}`);
      if (!res.ok) {
        setNamesById(prev => ({ ...prev, [id]: id }));
        return;
      }
      const data = await res.json();
      const val =
        type === "user"
          ? data?.company_name ||
            (data?.first_name && data?.last_name
              ? `${data.first_name} ${data.last_name}`
              : data?.first_name) ||
            data?.username ||
            data?.email
          : data?.[type]?.name || data?.name;

      setNamesById(prev => ({ ...prev, [id]: val || id }));
    } catch {
      setNamesById(prev => ({ ...prev, [id]: id }));
    }
  };

  // Fetch industry, technology, and user names
  useEffect(() => {
    if (solution.industry_id) fetchEntityName("industry", solution.industry_id);
    if (solution.technology_id) fetchEntityName("technology", solution.technology_id);
    if (solution.created_by) fetchEntityName("user", solution.created_by);
  }, [solution]);

  // Formula visualization state
  const [showFormulaModal, setShowFormulaModal] = useState<string | null>(null);
  const [selectedNodeValue, setSelectedNodeValue] = useState<{ node: string; value: string } | null>(null);
  const [showFullScreenGraph, setShowFullScreenGraph] = useState<boolean>(false);

  // Type definitions for formula visualization
  interface ASTNode {
    type: string;
    left?: ASTNode | string | number;
    right?: ASTNode | string | number;
    operand?: ASTNode | string | number;
  }

  interface GraphNode {
    id: string;
    label: string;
    type: 'variable' | 'operation' | 'result';
    x: number;
    y: number;
  }

  interface GraphEdge {
    id: string;
    from: string;
    to: string;
    type: 'input' | 'output' | 'direct';
    operation?: string;
  }

  interface ExpressionGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
  }

  // Validate formula
  const isValidFormula = useCallback((formula: string): boolean => {
    if (!formula || formula.trim() === '') return false;
    
    // Check for basic formula structure
    const trimmedFormula = formula.trim();
    
    // Must contain at least one operator
    const hasOperator = /[+\-*/^]/.test(trimmedFormula);
    if (!hasOperator) return false;
    
    // Must contain at least one variable or number
    const hasVariableOrNumber = /[a-zA-Z_][a-zA-Z0-9_]*|\d+/.test(trimmedFormula);
    if (!hasVariableOrNumber) return false;
    
    // Check for balanced parentheses
    const openParens = (trimmedFormula.match(/\(/g) || []).length;
    const closeParens = (trimmedFormula.match(/\)/g) || []).length;
    if (openParens !== closeParens) return false;
    
    // Check for valid characters only
    const validChars = /^[a-zA-Z0-9_+\-*/^()\s.]+$/;
    if (!validChars.test(trimmedFormula)) return false;
    
    return true;
  }, []);

  // Simple formula parser
  const parseFormula = useCallback((formula: string) => {
    const variables: string[] = [];
    const operators: string[] = [];
    
    // Extract variables (anything that's not an operator or number)
    const tokens = formula.split(/([+\-*/^()])/).filter(token => token.trim());
    tokens.forEach(token => {
      const trimmed = token.trim();
      if (trimmed && isNaN(Number(trimmed)) && !['+', '-', '*', '/', '^', '(', ')'].includes(trimmed)) {
        if (!variables.includes(trimmed)) {
          variables.push(trimmed);
        }
      }
    });
    
    // Extract operators
    tokens.forEach(token => {
      const trimmed = token.trim();
      if (['+', '-', '*', '/', '^'].includes(trimmed) && !operators.includes(trimmed)) {
        operators.push(trimmed);
      }
    });
    
    return { variables, operators, tokens };
  }, []);

  // Build expression graph for visualization
  const buildExpressionGraph = useCallback((formula: string): ExpressionGraph => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let nodeId = 0;
    
    const parsed = parseFormula(formula);
    const centerX = 300; // Center X coordinate
    const levelSpacing = 100; // Vertical spacing between levels
    
    // Create a simple AST-like structure based on the formula
    const createASTStructure = (formula: string) => {
      const tokens = formula.replace(/\s/g, '').split(/([+\-*/^()])/).filter(t => t);
      
      // Simple parsing to create a tree structure
      const result: any = {
        type: 'result',
        label: 'Result',
        children: []
      };
      
      // Find the main operator (simplified approach)
      let mainOp = null;
      let mainOpIndex = -1;
      
      // Look for multiplication/division first (higher precedence)
      for (let i = 0; i < tokens.length; i++) {
        if (['*', '/'].includes(tokens[i])) {
          mainOp = tokens[i];
          mainOpIndex = i;
          break;
        }
      }
      
      // If no multiplication/division, look for addition/subtraction
      if (!mainOp) {
        for (let i = 0; i < tokens.length; i++) {
          if (['+', '-'].includes(tokens[i])) {
            mainOp = tokens[i];
            mainOpIndex = i;
            break;
          }
        }
      }
      
      if (mainOp) {
        const leftSide = tokens.slice(0, mainOpIndex).join('');
        const rightSide = tokens.slice(mainOpIndex + 1).join('');
        
        result.children = [
          { type: 'operation', label: mainOp, children: [] },
          { type: 'variable', label: leftSide, children: [] },
          { type: 'variable', label: rightSide, children: [] }
        ];
      } else {
        // Single variable or number
        result.children = [
          { type: 'variable', label: tokens.join(''), children: [] }
        ];
      }
      
      return result;
    };
    
    const ast = createASTStructure(formula);
    
    // Position nodes based on AST structure
    const positionNodes = (node: any, x: number, y: number, level: number) => {
      const currentNodeId = `node_${nodeId++}`;
      
      nodes.push({
        id: currentNodeId,
        label: node.label,
        type: node.type as 'variable' | 'operation' | 'result',
        x: x,
        y: y
      });
      
      if (node.children && node.children.length > 0) {
        const childSpacing = 150; // Horizontal spacing between children
        const totalWidth = (node.children.length - 1) * childSpacing;
        const startX = x - totalWidth / 2;
        
        node.children.forEach((child: any, index: number) => {
          const childX = startX + index * childSpacing;
          const childY = y + levelSpacing;
          
          const childNodeId = positionNodes(child, childX, childY, level + 1);
          
          // Add edge from parent to child
          edges.push({
            id: `edge_${edges.length}`,
            from: currentNodeId,
            to: childNodeId,
            type: 'direct'
          });
        });
      }
      
      return currentNodeId;
    };
    
    // Start positioning from the root
    positionNodes(ast, centerX, 80, 0);
    
    return { nodes, edges };
  }, [parseFormula]);

  // Formula Modal Component
  const FormulaModal = ({ formulaName, formula, onClose }: { 
    formulaName: string; 
    formula: string; 
    onClose: () => void; 
  }) => {
    const graph = useMemo(() => buildExpressionGraph(formula), [formula, buildExpressionGraph]);
    
    const handleNodeClick = (node: GraphNode) => {
      setSelectedNodeValue({ node: node.id, value: node.label });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Formula Analysis: {formulaName}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-gray-300 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formula Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Formula Details
              </h3>
              
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-2">Formula Expression:</div>
                <code className="text-sm font-mono text-gray-800 bg-white p-2 rounded border block">
                  {formula}
                </code>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Analysis</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Variables: {parseFormula(formula).variables.join(', ') || 'None'}</p>
                  <p>• Operators: {parseFormula(formula).operators.join(', ') || 'None'}</p>
                  <p>• Complexity: {parseFormula(formula).tokens.length} tokens</p>
                </div>
              </div>
            </div>
            
            {/* Graph Visualization */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  Expression Graph
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFullScreenGraph(true)}
                  className="border-gray-300 hover:bg-gray-50"
                >
                  <Maximize2 className="h-4 w-4 mr-1" />
                  Expand
                </Button>
              </div>
              
              <div className="bg-white rounded-lg p-4 min-h-[500px] relative overflow-auto border border-gray-200">
                <svg width="100%" height="500" className="rounded">
                  {graph.edges.map((edge) => {
                    const fromNode = graph.nodes.find(n => n.id === edge.from);
                    const toNode = graph.nodes.find(n => n.id === edge.to);
                    
                    if (!fromNode || !toNode) return null;
                    
                    return (
                      <line
                        key={edge.id}
                        x1={fromNode.x + 50}
                        y1={fromNode.y + 30}
                        x2={toNode.x + 50}
                        y2={toNode.y + 30}
                        stroke="#000000"
                        strokeWidth="3"
                        markerEnd="url(#arrowhead)"
                      />
                    );
                  })}
                  
                  {graph.nodes.map((node) => (
                    <g key={node.id}>
                      <rect
                        x={node.x}
                        y={node.y}
                        width={node.type === 'operation' ? 80 : 100}
                        height={40}
                        rx={4}
                        fill="#ffffff"
                        stroke="#000000"
                        strokeWidth={selectedNodeValue?.node === node.id ? 3 : 2}
                        className="cursor-pointer hover:opacity-80 transition-all duration-200"
                        onClick={() => handleNodeClick(node)}
                      />
                      <text
                        x={node.x + (node.type === 'operation' ? 40 : 50)}
                        y={node.y + 25}
                        textAnchor="middle"
                        className="text-sm font-semibold fill-black pointer-events-none"
                      >
                        {node.label}
                      </text>
                    </g>
                  ))}
                  
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="12"
                      markerHeight="8"
                      refX="10"
                      refY="4"
                      orient="auto"
                    >
                      <polygon points="0 0, 12 4, 0 8" fill="#000000" />
                    </marker>
                  </defs>
                </svg>
                
                {selectedNodeValue && (
                  <div className="absolute top-4 right-4 bg-white p-3 rounded-lg border-2 border-black shadow-lg">
                    <div className="text-xs text-gray-600 font-medium">Selected Node:</div>
                    <div className="text-sm font-bold text-black">{selectedNodeValue.value}</div>
                  </div>
                )}
              </div>
              
              {/* Legend */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium mb-2 text-sm">Graph Legend</h4>
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-3 bg-white border-2 border-black rounded"></div>
                    <span className="font-medium">Normal Node</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-3 bg-white border-3 border-black rounded"></div>
                    <span className="font-medium">Selected Node</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-0.5 bg-black"></div>
                    <span className="font-medium">Connection</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Full Screen Graph Modal Component
  const FullScreenGraphModal = ({ formulaName, formula, onClose }: { 
    formulaName: string; 
    formula: string; 
    onClose: () => void; 
  }) => {
    const graph = useMemo(() => buildExpressionGraph(formula), [formula, buildExpressionGraph]);
    
    const handleNodeClick = (node: GraphNode) => {
      setSelectedNodeValue({ node: node.id, value: node.label });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full h-full max-w-none max-h-none m-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Expression Graph: {formulaName}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-gray-300 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex flex-col h-full">
            {/* Formula Details */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 mb-2">Formula Expression:</div>
              <code className="text-lg font-mono text-gray-800 bg-white p-3 rounded border block">
                {formula}
              </code>
            </div>
            
            {/* Full Screen Graph */}
            <div className="flex-1 bg-white rounded-lg p-6 border border-gray-200 relative overflow-auto">
              <svg width="100%" height="100%" className="rounded">
                {graph.edges.map((edge) => {
                  const fromNode = graph.nodes.find(n => n.id === edge.from);
                  const toNode = graph.nodes.find(n => n.id === edge.to);
                  
                  if (!fromNode || !toNode) return null;
                  
                  return (
                    <line
                      key={edge.id}
                      x1={fromNode.x + (fromNode.type === 'operation' ? 40 : 50)}
                      y1={fromNode.y + 20}
                      x2={toNode.x + (toNode.type === 'operation' ? 40 : 50)}
                      y2={toNode.y + 20}
                      stroke="#000000"
                      strokeWidth="4"
                      markerEnd="url(#arrowhead-fullscreen)"
                    />
                  );
                })}
                
                {graph.nodes.map((node) => (
                  <g key={node.id}>
                    <rect
                      x={node.x}
                      y={node.y}
                      width={node.type === 'operation' ? 120 : 140}
                      height={60}
                      rx={6}
                      fill="#ffffff"
                      stroke="#000000"
                      strokeWidth={selectedNodeValue?.node === node.id ? 4 : 3}
                      className="cursor-pointer hover:opacity-80 transition-all duration-200"
                      onClick={() => handleNodeClick(node)}
                    />
                    <text
                      x={node.x + (node.type === 'operation' ? 60 : 70)}
                      y={node.y + 35}
                      textAnchor="middle"
                      className="text-lg font-bold fill-black pointer-events-none"
                    >
                      {node.label}
                    </text>
                  </g>
                ))}
                
                <defs>
                  <marker
                    id="arrowhead-fullscreen"
                    markerWidth="16"
                    markerHeight="12"
                    refX="14"
                    refY="6"
                    orient="auto"
                  >
                    <polygon points="0 0, 16 6, 0 12" fill="#000000" />
                  </marker>
                </defs>
              </svg>
              
              {selectedNodeValue && (
                <div className="absolute top-6 right-6 bg-white p-4 rounded-lg border-3 border-black shadow-xl">
                  <div className="text-sm text-gray-600 font-medium">Selected Node:</div>
                  <div className="text-lg font-bold text-black">{selectedNodeValue.value}</div>
                </div>
              )}
            </div>
            
            {/* Legend */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-medium mb-3 text-base">Graph Legend</h4>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-4 bg-white border-2 border-black rounded"></div>
                  <span className="font-medium">Normal Node</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-4 bg-white border-4 border-black rounded"></div>
                  <span className="font-medium">Selected Node</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-1 bg-black"></div>
                  <span className="font-medium">Connection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  navigate.push("/");
                  setCurrentPage();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{solution.solution_name}</h1>
                <p className="text-gray-600">{solution.solution_description}</p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(solution.status)}`}
            >
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
                  <div className="font-semibold text-gray-900">
                    {namesById[solution.industry_id] || solution.industry_id}
                  </div>
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
                  <div className="font-semibold text-gray-900">
                    {namesById[solution.technology_id] || solution.technology_id}
                  </div>
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
                  <div className="font-semibold text-gray-900">
                    {namesById[solution.created_by] || solution.created_by}
                  </div>
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
                  <div className="font-semibold text-gray-900">
                    {new Date(solution.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Parameters Section */}
          <Card className="border-gray-200 h-fit">
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
                          {typeof calc.result === "number" ? calc.result.toLocaleString() : calc.result}
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
                      <div className="flex items-center gap-2">
                        {isValidFormula(calc.formula) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFormulaModal(calc.id)}
                            className="border-gray-300 hover:bg-gray-50"
                          >
                            <TrendingUp className="h-4 w-4 mr-1" />
                            Visualize
                          </Button>
                        )}
                        <span className="text-xs text-green-600 font-medium">{calc.status}</span>
                      </div>
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
                <div className="text-gray-600">
                  {namesById[solution.client_id] || solution.client_id }
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Last Updated</h4>
                <div className="text-gray-600">{formatDate(solution.created_at)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formula Visualization Modal */}
      {showFormulaModal && (() => {
        const calc = solution.calculations.find(c => c.id === showFormulaModal);
        return calc ? (
          <FormulaModal
            formulaName={calc.name}
            formula={calc.formula}
            onClose={() => setShowFormulaModal(null)}
          />
        ) : null;
      })()}

      {/* Full Screen Graph Modal */}
      {showFullScreenGraph && (() => {
        const calc = solution.calculations.find(c => c.id === showFormulaModal);
        return calc ? (
          <FullScreenGraphModal
            formulaName={calc.name}
            formula={calc.formula}
            onClose={() => setShowFullScreenGraph(false)}
          />
        ) : null;
      })()}
    </div>
  );
};
