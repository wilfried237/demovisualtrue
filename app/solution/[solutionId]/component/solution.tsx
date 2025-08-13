"use client";

import { SolutionConfiguration, TreeNode } from "@/app/type/types";
import { ArrowLeft, Building, Zap, User, Clock, Settings, Calculator, Info, TrendingUp, X, ChevronDown } from "lucide-react";
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
  const [recursivelyExpandedVariables, setRecursivelyExpandedVariables] = useState<Set<string>>(new Set());

  // Type definitions for formula visualization
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

  interface NestedVariable {
    name: string;
    type: string;
    formula?: string;
    result?: number | string | null;
    units?: string;
    unit?: string;
    status?: string;
    depth?: number;
    children?: NestedVariable[];
    value?: string | number;
    category?: { name: string };
    description?: string;
  }

  interface ASTNode {
    type: string;
    label: string;
    children: ASTNode[];
  }

  // Recursive expansion functions
  const toggleRecursiveExpansion = useCallback((variableName: string) => {
    setRecursivelyExpandedVariables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(variableName)) {
        newSet.delete(variableName);
      } else {
        newSet.add(variableName);
      }
      return newSet;
    });
  }, []);

  const isRecursivelyExpanded = useCallback((variableName: string) => {
    return recursivelyExpandedVariables.has(variableName);
  }, [recursivelyExpandedVariables]);





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

  // Get all nested variables recursively
  const getNestedVariables = useCallback((formula: string, depth: number = 0, maxDepth: number = 10): NestedVariable[] => {
    if (depth > maxDepth) return []; // Prevent infinite recursion
    
    const parsed = parseFormula(formula);
    const nestedVars: NestedVariable[] = [];
    
    parsed.variables.forEach(variable => {
      const variableCalc = solution.calculations.find(c => c.name === variable);
      if (variableCalc) {
        nestedVars.push({
          name: variable,
          type: 'formula',
          formula: variableCalc.formula,
          result: variableCalc.result || undefined,
          units: variableCalc.units,
          status: variableCalc.status,
          depth: depth + 1,
          children: getNestedVariables(variableCalc.formula, depth + 1, maxDepth)
        });
      } else {
        const parameter = solution.parameters.find(p => p.name === variable);
        if (parameter) {
          nestedVars.push({
            name: variable,
            type: 'parameter',
            value: parameter.value,
            unit: parameter.unit,
            category: parameter.category,
            description: parameter.description,
            depth: depth + 1,
            children: []
          });
        } else {
          nestedVars.push({
            name: variable,
            type: 'unknown',
            depth: depth + 1,
            children: []
          });
        }
      }
    });
    
    return nestedVars;
  }, [solution]);

  // Recursive Variable Component
  const RecursiveVariableComponent = ({ variable, depth = 0 }: { variable: NestedVariable; depth?: number }) => {
    const isExpanded = isRecursivelyExpanded(variable.name);
    const hasChildren = variable.children && variable.children.length > 0;
    
    const handleToggle = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggleRecursiveExpansion(variable.name);
    };
    
    return (
      <div className="space-y-2">
        <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
          variable.type === 'formula' 
            ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
            : variable.type === 'parameter' 
              ? 'bg-green-50 border-green-200 hover:bg-green-100'
              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {hasChildren && (
                <button
                  onClick={handleToggle}
                  className="p-1 hover:bg-white rounded transition-colors"
                  type="button"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
              <span className={`font-medium ${
                variable.type === 'formula' ? 'text-blue-800' : 
                variable.type === 'parameter' ? 'text-green-800' : 
                'text-gray-600'
              }`}>
                {variable.name}
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                variable.type === 'formula' ? 'bg-blue-200 text-blue-700' : 
                variable.type === 'parameter' ? 'bg-green-200 text-green-700' : 
                'bg-gray-200 text-gray-600'
              }`}>
                {variable.type}
              </span>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            {variable.type === 'formula' && (
              <span>Result: {typeof variable.result === "number" ? variable.result.toLocaleString() : variable.result} {variable.units}</span>
            )}
            {variable.type === 'parameter' && (
              <span>Value: {variable.value} {variable.unit}</span>
            )}
          </div>
        </div>
        
        {isExpanded && hasChildren && (
          <div className="ml-6 space-y-2 border-l-2 border-gray-200 pl-4">
            {variable.type === 'formula' && (
              <div className="mb-3 p-2 bg-gray-50 rounded border">
                <div className="text-xs text-gray-500 mb-1">Formula:</div>
                <code className="text-sm font-mono text-gray-800">{variable.formula}</code>
              </div>
            )}
            
            {variable.children?.map((child: NestedVariable, index: number) => (
              <RecursiveVariableComponent 
                key={`${child.name}-${index}`} 
                variable={child} 
                depth={depth + 1} 
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Build expression graph for visualization with proper hierarchical structure
  const buildExpressionGraph = useCallback((formula: string, formulaName: string): ExpressionGraph => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let nodeId = 0;
    
    const centerX = 400; // Center X coordinate
    const levelSpacing = 120; // Vertical spacing between levels
    const nodeSpacing = 200; // Horizontal spacing between nodes
    
    // Create a proper hierarchical AST structure
    const createHierarchicalAST = (formula: string, formulaName: string) => {
      const tokens = formula.replace(/\s/g, '').split(/([+\-*/^()])/).filter(t => t);
      
      // Simple parsing to create a proper tree structure
      const result: ASTNode = {
        type: 'result',
        label: formulaName, // Use the actual formula name instead of "Result"
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
        
        // Create operation node with left and right children
        const operationNode: ASTNode = {
          type: 'operation',
          label: mainOp,
          children: [
            { type: 'variable', label: leftSide, children: [] },
            { type: 'variable', label: rightSide, children: [] }
          ]
        };
        
        result.children = [operationNode];
      } else {
        // Single variable or number
        result.children = [
          { type: 'variable', label: tokens.join(''), children: [] }
        ];
      }
      
      return result;
    };
    
    const ast = createHierarchicalAST(formula, formulaName);
    
    // Position nodes in a proper hierarchical tree structure
    const positionNodes = (node: ASTNode, x: number, y: number, level: number) => {
      const currentNodeId = `node_${nodeId++}`;
      
      nodes.push({
        id: currentNodeId,
        label: node.label,
        type: node.type as 'variable' | 'operation' | 'result',
        x: x,
        y: y
      });
      
      if (node.children && node.children.length > 0) {
        if (node.children.length === 1) {
          // Single child - position directly below
          const child = node.children[0];
          const childY = y + levelSpacing;
          const childNodeId = positionNodes(child, x, childY, level + 1);
          
          edges.push({
            id: `edge_${edges.length}`,
            from: currentNodeId,
            to: childNodeId,
            type: 'direct'
          });
        } else if (node.children.length === 2) {
          // Two children - position left and right
          const [leftChild, rightChild] = node.children;
          const leftX = x - nodeSpacing / 2;
          const rightX = x + nodeSpacing / 2;
          const childY = y + levelSpacing;
          
          const leftNodeId = positionNodes(leftChild, leftX, childY, level + 1);
          const rightNodeId = positionNodes(rightChild, rightX, childY, level + 1);
          
          edges.push({
            id: `edge_${edges.length}`,
            from: currentNodeId,
            to: leftNodeId,
            type: 'direct'
          });
          
          edges.push({
            id: `edge_${edges.length}`,
            from: currentNodeId,
            to: rightNodeId,
            type: 'direct'
          });
        } else {
          // Multiple children - distribute evenly
          const totalWidth = (node.children.length - 1) * nodeSpacing;
          const startX = x - totalWidth / 2;
          
          node.children.forEach((child: ASTNode, index: number) => {
            const childX = startX + index * nodeSpacing;
            const childY = y + levelSpacing;
            
            const childNodeId = positionNodes(child, childX, childY, level + 1);
            
            edges.push({
              id: `edge_${edges.length}`,
              from: currentNodeId,
              to: childNodeId,
              type: 'direct'
            });
          });
        }
      }
      
      return currentNodeId;
    };
    
    // Start positioning from the root
    positionNodes(ast, centerX, 100, 0);
    
    return { nodes, edges };
  }, [parseFormula]);

  // Formula Modal Component with circular nodes
  const FormulaModal = ({ formulaName, formula, onClose }: { 
    formulaName: string; 
    formula: string; 
    onClose: () => void; 
  }) => {
    const graph = useMemo(() => buildExpressionGraph(formula, formulaName), [formula, formulaName]);
    
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
            {/* Interactive Formula Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Interactive Formula Details
              </h3>
              
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-2">Formula Expression:</div>
                <div className="bg-white p-3 rounded border">
                  {parseFormula(formula).tokens.map((token, index) => {
                    const isVariable = parseFormula(formula).variables.includes(token);
                    const isOperator = parseFormula(formula).operators.includes(token);
                    
                    if (isVariable) {
                      return (
                        <span key={index}>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleRecursiveExpansion(token);
                            }}
                            className="inline-flex items-center px-2 py-1 mx-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors font-medium text-sm"
                          >
                            {token}
                            <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${isRecursivelyExpanded(token) ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {isRecursivelyExpanded(token) && (
                            <div className="mt-2 ml-4 p-3 bg-white border border-blue-200 rounded-lg shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-semibold text-blue-900">{token}</h5>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Variable</span>
                              </div>
                              
                              {/* Check if this variable has a formula in the solution */}
                              {(() => {
                                const variableCalc = solution.calculations.find(c => c.name === token);
                                if (variableCalc) {
                                  return (
                                    <div className="space-y-2">
                                      <div className="text-sm text-gray-600">
                                        <span className="font-medium">Formula:</span> {variableCalc.formula}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        <span className="font-medium">Result:</span> {typeof variableCalc.result === "number" ? variableCalc.result.toLocaleString() : variableCalc.result}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        <span className="font-medium">Units:</span> {variableCalc.units}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        <span className="font-medium">Status:</span> 
                                        <span className={`ml-1 px-2 py-1 rounded text-xs ${variableCalc.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                          {variableCalc.status}
                                        </span>
                                      </div>
                                      
                                      {/* Recursive variable analysis */}
                                      <div className="mt-3 pt-3 border-t border-gray-200">
                                        <h6 className="font-medium text-gray-700 mb-2">Variable Dependencies:</h6>
                                        <div className="space-y-1">
                                          {parseFormula(variableCalc.formula).variables.map((depVar, depIndex) => (
                                            <div key={depIndex} className="flex items-center justify-between">
                                              <span className="text-sm text-gray-600">{depVar}</span>
                                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                                {solution.calculations.find(c => c.name === depVar) ? 'Formula' : 'Parameter'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                } else {
                                  // Check if it's a parameter
                                  const parameter = solution.parameters.find(p => p.name === token);
                                  if (parameter) {
                                    return (
                                      <div className="space-y-2">
                                        <div className="text-sm text-gray-600">
                                          <span className="font-medium">Type:</span> Parameter
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          <span className="font-medium">Value:</span> {parameter.value}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          <span className="font-medium">Unit:</span> {parameter.unit}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          <span className="font-medium">Category:</span> {parameter.category.name}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          <span className="font-medium">Description:</span> {parameter.description}
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div className="text-sm text-gray-500 italic">
                                        Variable not found in current solution
                                      </div>
                                    );
                                  }
                                }
                              })()}
                            </div>
                          )}
                        </span>
                      );
                    } else if (isOperator) {
                      return (
                        <span key={index} className="inline-block px-2 py-1 mx-1 bg-gray-100 text-gray-800 rounded font-mono text-sm">
                          {token}
                        </span>
                      );
                    } else {
                      return (
                        <span key={index} className="inline-block px-2 py-1 mx-1 bg-white text-gray-600 rounded font-mono text-sm">
                          {token}
                        </span>
                      );
                    }
                  })}
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Formula Analysis</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Variables: {parseFormula(formula).variables.length} found</p>
                  <p>• Operators: {parseFormula(formula).operators.join(', ') || 'None'}</p>
                  <p>• Complexity: {parseFormula(formula).tokens.length} tokens</p>
                  <p>• Dependencies: {parseFormula(formula).variables.filter(v => solution.calculations.find(c => c.name === v)).length} formulas, {parseFormula(formula).variables.filter(v => solution.parameters.find(p => p.name === v)).length} parameters</p>
                </div>
              </div>

              {/* Recursive Variable Expansion */}
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-purple-900">Infinite Variable Expansion</h4>
                  <span className="text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded">Click to expand</span>
                </div>
                <p className="text-sm text-purple-700 mb-4">
                  Expand variables recursively to see their formulas and dependencies. Continue expanding until you reach base parameters.
                </p>
                
                <div className="space-y-2">
                  {getNestedVariables(formula).map((variable, index) => (
                    <RecursiveVariableComponent 
                      key={`${variable.name}-${index}`} 
                      variable={variable} 
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Graph Visualization */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  Expression Graph
                </h3>
              </div>
              
              <div className="bg-white rounded-lg p-4 min-h-[500px] relative overflow-auto border border-gray-200">
                <svg width="100%" height="500" className="rounded">
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#000000" />
                    </marker>
                  </defs>
                  
                  {graph.edges.map((edge) => {
                    const fromNode = graph.nodes.find(n => n.id === edge.from);
                    const toNode = graph.nodes.find(n => n.id === edge.to);
                    
                    if (!fromNode || !toNode) return null;
                    
                    // Calculate circle sizes for proper connection points
                    const calculateCircleSize = (text: string): number => {
                      const textLength = text.length;
                      let diameter;
                      if (textLength <= 3) {
                        diameter = 50; // Small operators like +, -, ×, ÷
                      } else if (textLength <= 6) {
                        diameter = 65; // Medium words like "Capex", "Opex"
                      } else if (textLength <= 10) {
                        diameter = 85; // Longer names like "Total_Cost"
                      } else if (textLength <= 15) {
                        diameter = 105; // Very long names like "Equipment_Cost"
                      } else {
                        diameter = 125; // Extra long names
                      }
                      return Math.max(50, Math.min(130, diameter));
                    };
                    
                    const fromDiameter = calculateCircleSize(fromNode.label);
                    const toDiameter = calculateCircleSize(toNode.label);
                    
                    // Connect from bottom of parent to top of child
                    const fromY = fromNode.y + fromDiameter / 2;
                    const toY = toNode.y - toDiameter / 2;
                    
                    return (
                      <g key={edge.id}>
                        <line
                          x1={fromNode.x}
                          y1={fromY}
                          x2={toNode.x}
                          y2={toY}
                          stroke="#000000"
                          strokeWidth="2"
                          markerEnd="url(#arrowhead)"
                        />
                      </g>
                    );
                  })}
                </svg>
                
                {/* Render circular nodes as divs for better text handling */}
                {graph.nodes.map((node) => {
                  // Calculate circle size based on text content
                  const calculateCircleSize = (text: string): number => {
                    const textLength = text.length;
                    let diameter;
                    if (textLength <= 3) {
                      diameter = 50; // Small operators like +, -, ×, ÷
                    } else if (textLength <= 6) {
                      diameter = 65; // Medium words like "Capex", "Opex"
                    } else if (textLength <= 10) {
                      diameter = 85; // Longer names like "Total_Cost"
                    } else if (textLength <= 15) {
                      diameter = 105; // Very long names like "Equipment_Cost"
                    } else {
                      diameter = 125; // Extra long names
                    }
                    return Math.max(50, Math.min(130, diameter));
                  };
                  
                  const diameter = calculateCircleSize(node.label);
                  const nodeClasses = `absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white cursor-pointer transition-all duration-300 overflow-hidden ${
                    node.type === 'operation' 
                      ? 'border-black hover:bg-white' 
                      : node.type === 'result' 
                        ? 'border-blue-500 bg-blue-50 hover:bg-blue-100' 
                        : 'border-green-500 bg-green-50 hover:bg-green-100'
                  }`;
                  
                  return (
                    <div
                      key={node.id}
                      className={nodeClasses}
                      style={{ 
                        left: node.x, 
                        top: node.y,
                        width: `${diameter}px`,
                        height: `${diameter}px`
                      }}
                      onClick={() => handleNodeClick(node)}
                    >
                      <div 
                        className="w-full h-full flex items-center justify-center text-center"
                        style={{ 
                          padding: diameter > 100 ? '12px' : diameter > 80 ? '10px' : '8px'
                        }}
                      >
                        <span 
                          className="font-semibold select-none"
                          style={{ 
                            fontSize: diameter > 100 ? '14px' : diameter > 80 ? '13px' : diameter > 60 ? '12px' : '11px',
                            lineHeight: diameter > 60 ? '1.2' : '1.1',
                            wordBreak: 'break-word',
                            textAlign: 'center',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '100%',
                            color: node.type === 'result' ? '#1d4ed8' : node.type === 'operation' ? '#000000' : '#059669'
                          }}
                        >
                          {node.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
                
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
                    <div className="w-6 h-6 rounded-full bg-blue-50 border-2 border-blue-500"></div>
                    <span className="font-medium">Result Node</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-green-50 border-2 border-green-500"></div>
                    <span className="font-medium">Variable Node</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-white border-2 border-black"></div>
                    <span className="font-medium">Operation Node</span>
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

  // The rest of your component remains the same...
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
    </div>
  );
};