import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { XMLParser } from 'fast-xml-parser';
import { ComparisonResult, NodeComparisonResult, Module } from '../types';
import { getModuleInfo } from '../constants/moduleMapping';

const xmlToJson = (xml: Element): any => {
  // Create the return object
  let obj: any = {};

  // do attributes
  if (xml.attributes.length > 0) {
    obj['@_'] = {};
    for (let j = 0; j < xml.attributes.length; j++) {
      const attribute = xml.attributes.item(j);
      if (attribute) {
        obj['@_'][attribute.nodeName] = attribute.nodeValue;
      }
    }
  }

  // do children
  if (xml.hasChildNodes()) {
    let hasElementChildren = false;
    let textContent = '';

    for (let i = 0; i < xml.childNodes.length; i++) {
      const item = xml.childNodes.item(i);
      if (item.nodeType === 3) {
        // text node
        const text = item.nodeValue?.trim();
        if (text) {
          textContent = text;
        }
      } else if (item.nodeType === 1) {
        // element node
        hasElementChildren = true;
        const nodeName = item.nodeName;
        if (typeof obj[nodeName] === 'undefined') {
          obj[nodeName] = xmlToJson(item as Element);
        } else {
          if (typeof obj[nodeName].push === 'undefined') {
            const old = obj[nodeName];
            obj[nodeName] = [];
            obj[nodeName].push(old);
          }
          obj[nodeName].push(xmlToJson(item as Element));
        }
      }
    }

    // If we have text content and no element children, set it as the value
    if (textContent && !hasElementChildren) {
      obj = textContent;
    }
  }
  return obj;
};

export const AsBuiltComparer: React.FC = () => {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [vin1, setVin1] = useState<string>('');
  const [vin2, setVin2] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [nodeComparisonResults, setNodeComparisonResults] = useState<NodeComparisonResult[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [groupedResults, setGroupedResults] = useState<Record<string, ComparisonResult[]>>({});
  const [groupedNodeResults, setGroupedNodeResults] = useState<
    Record<string, NodeComparisonResult[]>
  >({});
  const [partNumberMap1, setPartNumberMap1] = useState<Map<string, string>>(new Map());
  const [partNumberMap2, setPartNumberMap2] = useState<Map<string, string>>(new Map());

  const handleFileUpload = (fileNumber: 1 | 2) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_',
          preserveOrder: false,
          trimValues: true,
          parseAttributeValue: true,
          parseTagValue: false, // critical change
          tagValueProcessor: (tagName, tagValue) => {
            if (typeof tagValue === 'string' && /^[0-9A-Fa-f]+$/.test(tagValue)) {
              const padded = tagValue.padStart(4, '0');
              return padded;
            }
            return tagValue;
          },
        });
        const result = parser.parse(e.target?.result as string);
        console.log(`File ${fileNumber} parsed result:`, result);

        // Extract VIN - handle both attribute and element formats
        const vin =
          result.AS_BUILT_DATA.VEHICLE['@_VIN'] ||
          result.AS_BUILT_DATA.VEHICLE.VIN ||
          'Unknown VIN';
        if (fileNumber === 1) {
          setFile1(file);
          setVin1(vin);
        } else {
          setFile2(file);
          setVin2(vin);
        }
        setError(null);
      } catch (err) {
        setError(
          `Error parsing file ${fileNumber}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    };
    reader.readAsText(file);
  };

  const compareFiles = async () => {
    if (!file1 || !file2) return;

    try {
      const text1 = await file1.text();
      const text2 = await file2.text();

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        preserveOrder: false,
        trimValues: true,
        parseAttributeValue: true,
        parseTagValue: false, // critical change
        tagValueProcessor: (tagName, tagValue) => {
          if (typeof tagValue === 'string' && /^[0-9A-Fa-f]+$/.test(tagValue)) {
            const padded = tagValue.padStart(4, '0');
            return padded;
          }
          return tagValue;
        },
      });

      const file1Data = parser.parse(text1);
      const file2Data = parser.parse(text2);

      console.log('File 1 parsed data:', file1Data);
      console.log('File 2 parsed data:', file2Data);

      // Debug the structure
      console.log('File 1 VEHICLE structure:', file1Data.AS_BUILT_DATA.VEHICLE);
      console.log('File 2 VEHICLE structure:', file2Data.AS_BUILT_DATA.VEHICLE);

      // Debug all keys in VEHICLE
      console.log('File 1 VEHICLE keys:', Object.keys(file1Data.AS_BUILT_DATA.VEHICLE));
      console.log('File 2 VEHICLE keys:', Object.keys(file2Data.AS_BUILT_DATA.VEHICLE));

      // Get all module types from both files
      const moduleTypes1 = Object.keys(file1Data.AS_BUILT_DATA.VEHICLE).filter(key =>
        key.endsWith('_MODULE')
      );
      const moduleTypes2 = Object.keys(file2Data.AS_BUILT_DATA.VEHICLE).filter(key =>
        key.endsWith('_MODULE')
      );

      console.log('Module types in file 1:', moduleTypes1);
      console.log('Module types in file 2:', moduleTypes2);

      // Compare each module type
      const results: ComparisonResult[] = [];
      const nodeResults: NodeComparisonResult[] = [];

      // Compare modules
      for (const moduleType of moduleTypes1) {
        const module1 = file1Data.AS_BUILT_DATA.VEHICLE[moduleType];
        const module2 = file2Data.AS_BUILT_DATA.VEHICLE[moduleType];

        console.log(`Comparing module ${moduleType}:`, { module1, module2 });

        // Create maps of DATA entries by their LABEL
        const dataMap1 = new Map();
        const dataMap2 = new Map();

        if (module1?.DATA) {
          module1.DATA.forEach((data: any) => {
            const label = data['@_LABEL'];
            if (label) {
              dataMap1.set(label, data);
            }
          });
        }

        if (module2?.DATA) {
          module2.DATA.forEach((data: any) => {
            const label = data['@_LABEL'];
            if (label) {
              dataMap2.set(label, data);
            }
          });
        }

        // Get all unique labels from both files
        const allLabels = new Set([...dataMap1.keys(), ...dataMap2.keys()]);

        // Compare each unique label
        for (const label of allLabels) {
          const data1 = dataMap1.get(label);
          const data2 = dataMap2.get(label);

          // Handle cases where data exists in one file but not the other
          if (!data1 && data2) {
            const moduleId = label.split('-')[0];
            const codes2 = data2.CODE.map((code: any) => {
              const codeStr = code.toString();
              return codeStr.padStart(4, '0');
            });
            results.push({
              label,
              nodeId: label,
              codes1: ['N/A', 'N/A', 'N/A'],
              codes2,
              ori2: data2.CODE,
              differences: [[]],
            });
            continue;
          } else if (data1 && !data2) {
            const moduleId = label.split('-')[0];
            const codes1 = data1.CODE.map((code: any) => {
              const codeStr = code.toString();
              return codeStr.padStart(4, '0');
            });
            results.push({
              label,
              nodeId: label,
              codes1,
              codes2: ['N/A', 'N/A', 'N/A'],
              ori2: [],
              differences: [[]],
            });
            continue;
          }

          // Both data entries exist, compare their codes
          const codes1 = data1.CODE.map((code: any) => {
            const codeStr = code.toString();
            return codeStr.padStart(4, '0');
          });
          const codes2 = data2.CODE.map((code: any) => {
            const codeStr = code.toString();
            return codeStr.padStart(4, '0');
          });

          // Collect differences
          let differences: number[][] = [];
          for (let j = 0; j < Math.max(codes1.length, codes2.length); j++) {
            const code1 = codes1[j] || '';
            const code2 = codes2[j] || '';

            if (code1 !== code2) {
              // Track character-level differences
              const charDifferences: number[] = [];
              for (let k = 0; k < Math.max(code1.length, code2.length); k++) {
                if (code1[k] !== code2[k]) {
                  charDifferences.push(k);
                }
              }
              differences.push(charDifferences);
            } else {
              differences.push([]);
            }
          }

          // Add to results regardless of differences
          results.push({
            label,
            nodeId: label,
            codes1,
            codes2,
            ori2: data2.CODE,
            differences,
          });
        }
      }

      // Compare nodes using their IDs as keys
      const nodeMap1 = new Map();
      const nodeMap2 = new Map();

      // Get NODEID elements from both files
      const nodeIds1 = file1Data.AS_BUILT_DATA.VEHICLE.NODEID || [];
      const nodeIds2 = file2Data.AS_BUILT_DATA.VEHICLE.NODEID || [];

      // Initialize part number maps
      let newPartNumberMap1 = new Map();
      let newPartNumberMap2 = new Map();

      // Process NODEID elements from file 1
      if (Array.isArray(nodeIds1)) {
        nodeIds1.forEach((node: any) => {
          // Remove leading zeros and pad to 3 characters
          const moduleId = node['#text']?.trim().replace(/^0+/, '').padStart(3, '0');
          if (moduleId && node.F113) {
            console.log(`File 1 - Module ${moduleId} part number:`, node.F113);
            newPartNumberMap1.set(moduleId, node.F113);
          }
        });
        setPartNumberMap1(newPartNumberMap1);
      }

      // Process NODEID elements from file 2
      if (Array.isArray(nodeIds2)) {
        nodeIds2.forEach((node: any) => {
          // Remove leading zeros and pad to 3 characters
          const moduleId = node['#text']?.trim().replace(/^0+/, '').padStart(3, '0');
          if (moduleId && node.F113) {
            console.log(`File 2 - Module ${moduleId} part number:`, node.F113);
            newPartNumberMap2.set(moduleId, node.F113);
          }
        });
        setPartNumberMap2(newPartNumberMap2);
      }

      // Use the newly created maps directly
      const finalPartNumberMap1 = newPartNumberMap1;
      const finalPartNumberMap2 = newPartNumberMap2;

      console.log('Final Part Number Map 1:', Object.fromEntries(finalPartNumberMap1));
      console.log('Final Part Number Map 2:', Object.fromEntries(finalPartNumberMap2));

      // Get all unique node IDs
      const allNodeIds = new Set([...nodeMap1.keys(), ...nodeMap2.keys()]);

      // Compare each unique node ID
      for (const nodeId of allNodeIds) {
        const node1 = nodeMap1.get(nodeId);
        const node2 = nodeMap2.get(nodeId);
        // Extract the 3-character module ID
        const moduleId = nodeId.split('-')[0];
        console.log(`Comparing node ${nodeId} (module ${moduleId}):`, {
          partNumber1: finalPartNumberMap1.get(moduleId),
          partNumber2: finalPartNumberMap2.get(moduleId),
        });

        if (!node1 && node2) {
          nodeResults.push({
            label: nodeId,
            nodeId: nodeId,
            value1: 'N/A',
            value2: node2['@_ID'],
            partNumber1: 'N/A',
            partNumber2: finalPartNumberMap2.get(moduleId) || 'N/A',
            difference: 'Node missing in Car 1',
          });
        } else if (node1 && !node2) {
          nodeResults.push({
            label: nodeId,
            nodeId: nodeId,
            value1: node1['@_ID'],
            value2: 'N/A',
            partNumber1: finalPartNumberMap1.get(moduleId) || 'N/A',
            partNumber2: 'N/A',
            difference: 'Node missing in Car 2',
          });
        } else {
          const partNumber1 = finalPartNumberMap1.get(moduleId) || 'N/A';
          const partNumber2 = finalPartNumberMap2.get(moduleId) || 'N/A';
          const differences = [];

          if (node1['@_ID'] !== node2['@_ID']) {
            differences.push('Node ID changed');
          }
          if (partNumber1 !== partNumber2) {
            differences.push('Part number changed');
          }

          if (differences.length > 0) {
            nodeResults.push({
              label: nodeId,
              nodeId: nodeId,
              value1: node1['@_ID'],
              value2: node2['@_ID'],
              partNumber1,
              partNumber2,
              difference: differences.join(', '),
            });
          }
        }
      }

      // Update the state with the final maps
      setPartNumberMap1(finalPartNumberMap1);
      setPartNumberMap2(finalPartNumberMap2);

      console.log('Comparison results:', { results, nodeResults });

      // Group results by module type
      const groupedResultsMap = results.reduce(
        (acc, result) => {
          // Extract the 3-character module ID
          const moduleId = result.label.split('-')[0];
          if (!acc[moduleId]) {
            acc[moduleId] = [];
          }
          acc[moduleId].push(result);
          return acc;
        },
        {} as Record<string, ComparisonResult[]>
      );

      // Group node results by module type
      const groupedNodeResultsMap = nodeResults.reduce(
        (acc, result) => {
          // Extract the 3-character module ID
          const moduleId = result.label.split('-')[0];
          if (!acc[moduleId]) {
            acc[moduleId] = [];
          }
          acc[moduleId].push(result);
          return acc;
        },
        {} as Record<string, NodeComparisonResult[]>
      );

      console.log('Grouped results:', groupedResultsMap);
      console.log('Grouped node results:', groupedNodeResultsMap);

      setComparisonResults(results);
      setNodeComparisonResults(nodeResults);
      setGroupedResults(groupedResultsMap);
      setGroupedNodeResults(groupedNodeResultsMap);
      setShowComparison(true);
    } catch (error) {
      console.error('Error comparing files:', error);
      setError(`Error comparing files: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const renderCodeWithDifferences = (code: string, differences: boolean[]) => {
    return (
      <Box component="span" sx={{ fontFamily: 'monospace' }}>
        {code.split('').map((char, index) => (
          <Box
            key={index}
            component="span"
            sx={{
              backgroundColor: differences[index] ? 'error.light' : 'transparent',
              color: differences[index] ? 'error.contrastText' : 'inherit',
            }}
          >
            {char}
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="contained" component="label" sx={{ minWidth: 200 }}>
              Select Car 1
              <input type="file" hidden accept=".ab" onChange={handleFileUpload(1)} />
            </Button>
            <Button variant="contained" component="label" sx={{ minWidth: 200 }}>
              Select Car 2
              <input type="file" hidden accept=".ab" onChange={handleFileUpload(2)} />
            </Button>
          </Box>
          <Button variant="contained" onClick={compareFiles} disabled={!file1 || !file2}>
            Compare Files
          </Button>
          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </Box>
      </Paper>

      {showComparison && (
        <div>
          <Box
            sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Typography variant="h6">Car 1 VIN: {vin1}</Typography>
            <Typography variant="h6">Car 2 VIN: {vin2}</Typography>
          </Box>
          <h2>Comparison Results</h2>
          {Object.entries(groupedResults).map(([moduleId, results]) => {
            const moduleInfo = getModuleInfo(moduleId);
            const moduleName = moduleInfo
              ? `${moduleInfo.shortName} (${moduleInfo.longName})`
              : moduleId;

            return (
              <Accordion key={moduleId}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>
                    {moduleName} - {results.length} blocks{' '}
                    {results.filter(r => r.differences.some(diff => diff.length > 0)).length ===
                    0 ? (
                      <Box component="span" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                        Identical
                      </Box>
                    ) : (
                      `(${results.filter(r => r.differences.some(diff => diff.length > 0)).length} differences)`
                    )}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1">
                      Part Numbers:{' '}
                      <Box
                        component="span"
                        sx={{
                          color:
                            partNumberMap1.get(moduleId) === partNumberMap2.get(moduleId)
                              ? 'success.main'
                              : 'inherit',
                          fontWeight:
                            partNumberMap1.get(moduleId) === partNumberMap2.get(moduleId)
                              ? 'bold'
                              : 'normal',
                        }}
                      >
                        {partNumberMap1.get(moduleId) || 'N/A'} /{' '}
                        {partNumberMap2.get(moduleId) || 'N/A'}
                      </Box>
                    </Typography>
                  </Box>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Block ID</TableCell>
                        <TableCell colSpan={2}>Code 1</TableCell>
                        <TableCell colSpan={2}>Code 2</TableCell>
                        <TableCell colSpan={2}>Code 3</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell></TableCell>
                        <TableCell>Car 1</TableCell>
                        <TableCell>Car 2</TableCell>
                        <TableCell>Car 1</TableCell>
                        <TableCell>Car 2</TableCell>
                        <TableCell>Car 1</TableCell>
                        <TableCell>Car 2</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.map((result, index) => {
                        return (
                          <TableRow key={index}>
                            <TableCell>{result.nodeId}</TableCell>
                            {[0, 1, 2].map(codeIndex => {
                              const code1 = result.codes1[codeIndex] || '';
                              const code2 = result.codes2[codeIndex] || '';
                              const charDifferences = result.differences[codeIndex] || [];
                              const hasDifferences = charDifferences.length > 0;
                              const isIdentical = !hasDifferences && code1 !== '' && code2 !== '';
                              const isNA = code1 === 'N/A' || code2 === 'N/A';

                              return (
                                <React.Fragment key={codeIndex}>
                                  <TableCell
                                    sx={{
                                      backgroundColor: isNA
                                        ? 'warning.dark'
                                        : isIdentical
                                          ? 'success.light'
                                          : 'transparent',
                                      color: isNA
                                        ? 'warning.contrastText'
                                        : isIdentical
                                          ? 'success.contrastText'
                                          : 'inherit',
                                    }}
                                  >
                                    {code1.split('').map((char, charIndex) => (
                                      <Box
                                        key={charIndex}
                                        component="span"
                                        sx={{
                                          backgroundColor: charDifferences.includes(charIndex)
                                            ? 'error.light'
                                            : 'transparent',
                                          color: charDifferences.includes(charIndex)
                                            ? 'error.contrastText'
                                            : 'inherit',
                                        }}
                                      >
                                        {char}
                                      </Box>
                                    ))}
                                  </TableCell>
                                  <TableCell
                                    sx={{
                                      backgroundColor: isNA
                                        ? 'warning.dark'
                                        : isIdentical
                                          ? 'success.light'
                                          : 'transparent',
                                      color: isNA
                                        ? 'warning.contrastText'
                                        : isIdentical
                                          ? 'success.contrastText'
                                          : 'inherit',
                                    }}
                                  >
                                    {code2.split('').map((char, charIndex) => (
                                      <Box
                                        key={charIndex}
                                        component="span"
                                        sx={{
                                          backgroundColor: charDifferences.includes(charIndex)
                                            ? 'error.light'
                                            : 'transparent',
                                          color: charDifferences.includes(charIndex)
                                            ? 'error.contrastText'
                                            : 'inherit',
                                        }}
                                      >
                                        {char}
                                      </Box>
                                    ))}
                                  </TableCell>
                                </React.Fragment>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </AccordionDetails>
              </Accordion>
            );
          })}

          {Object.entries(groupedNodeResults).map(([moduleId, results]) => {
            const moduleInfo = getModuleInfo(moduleId);
            const moduleName = moduleInfo
              ? `${moduleInfo.shortName} (${moduleInfo.longName})`
              : moduleId;

            return (
              <Accordion key={moduleId}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>
                    {moduleName} - {results.length} block differences
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Block</TableCell>
                        <TableCell>Car 1</TableCell>
                        <TableCell>Car 2</TableCell>
                        <TableCell>Part Number (Car 1)</TableCell>
                        <TableCell>Part Number (Car 2)</TableCell>
                        <TableCell>Difference</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell>{result.label}</TableCell>
                          <TableCell>{result.value1}</TableCell>
                          <TableCell>{result.value2}</TableCell>
                          <TableCell>{result.partNumber1}</TableCell>
                          <TableCell>{result.partNumber2}</TableCell>
                          <TableCell>{result.difference}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </div>
      )}
    </Box>
  );
};
