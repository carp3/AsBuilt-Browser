import {
  Box,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AsBuiltData, Module } from '../types';
import { moduleMapping, nodeIdToModule } from '@/constants/moduleMapping.ts';

interface AsBuiltViewerProps {
  data: AsBuiltData;
}

interface NodeData {
  prefix: string;
  codes: Record<string, string>;
}

interface ModuleInfo {
  longName: string;
  shortName: string;
  prefix: string;
}

interface ErrorData {
  '@_CODE': string;
  '@_DESC': string;
  ERRORCODE?: string;
  ERRORMSG?: string;
}

interface ModuleDataItem {
  '@_LABEL': string;
  CODE?: string[];
}

// F-code mapping from NodeNames.txt
const fCodeMapping: Record<string, string> = {
  F10A: 'ECU Cal-Config Part Number',
  F110: 'On-line Diagnostic Database Reference Number',
  F111: 'ECU Core Assembly Number',
  F113: 'ECU Delivery Assembly Number',
  F124: 'ECU Calibration Data #1 Number',
  F162: 'Software Download Specification Version',
  F163: 'Diagnostic Specification Version',
  F188: 'Vehicle Manufacturer ECU Software Number',
  F18C: 'ECU Serial Number',
  F0E8: 'Private Sub Node #1 Software Number',
  F0E9: 'Private Sub Node #2 Software Number',
  F108: 'ECU Network Signal Calibration Number',
  F129: 'Private Sub Node #1 Core Assembly Number',
  F12A: 'Private Sub Node #2 Part Number',
  F141: 'Private Sub Node #1 Serial Number',
  F142: 'Private Sub Node #2 Serial Number',
  F16B: 'ECU Cal-Config #2 Part Number',
  F16C: 'ECU Cal-Config #3 Part Number',
  F16D: 'ECU Cal-Config #4 Part Number',
  F16E: 'ECU Cal-Config #5 Part Number',
  F17D: 'ECU Cal-Config #6 Part Number',
  F1D0: 'ECU MAC Address 1',
  F1D1: 'ECU MAC Address 2',
  E21X: 'Part Number Identification',
  E610: 'ECU Hardware Part Number',
  E611: 'ECU Strategy Software Part Number',
  E6F2: 'Configuration and Programming Version',
  E6F3: 'CAN Diagnostic Specification Version',
  FFEE: 'Reserved For Part II',
};

function parseNodeId(nodeId: any): NodeData[] {
  if (!nodeId) return [];

  // Handle array of NODEID entries
  const nodes = Array.isArray(nodeId) ? nodeId : [nodeId];

  return nodes
    .map(node => {
      // Get the prefix (text content before the F-codes)
      let prefix = '';
      if (typeof node === 'string') {
        prefix = node;
      } else if (node && typeof node === 'object') {
        // The prefix is the text content of the NODEID element
        const textContent = node['#text'];
        if (textContent !== undefined && textContent !== null) {
          prefix = String(textContent);
        }
      }

      // Get all F-codes
      const codes: Record<string, string> = {};
      if (node && typeof node === 'object') {
        Object.entries(node).forEach(([key, value]) => {
          if (key.startsWith('F')) {
            codes[key] = value as string;
          }
        });
      }

      return { prefix, codes };
    })
    .filter(node => node.prefix); // Only include nodes that have a prefix
}

function getModuleInfo(label: string): ModuleInfo | undefined {
  // Extract the prefix from the label (e.g., "7D0-01-01" -> "7D0")
  const prefix = label.split('-')[0];
  return moduleMapping[prefix];
}

function getFCodeDescription(code: string): string {
  return fCodeMapping[code] || code;
}

function getNodeModuleName(prefix: string): string {
  return nodeIdToModule[prefix] || prefix;
}

export const AsBuiltViewer: React.FC<AsBuiltViewerProps> = ({ data }) => {
  // Debug the data structure
  console.log('AsBuiltViewer received data:', JSON.stringify(data, null, 2));

  if (!data?.AS_BUILT_DATA?.VEHICLE) {
    console.error('Invalid data structure:', data);
    return null;
  }

  const { VEHICLE } = data.AS_BUILT_DATA;
  const nodeData = parseNodeId(VEHICLE.NODEID);
  console.log('Parsed node data:', JSON.stringify(nodeData, null, 2));

  // Collect all unique F-codes for table headers
  const fCodes = new Set<string>();
  nodeData.forEach(node => {
    Object.keys(node.codes).forEach(code => fCodes.add(code));
  });
  const fCodeArray = Array.from(fCodes).sort();

  // Group BCE modules by their prefix and sort them
  const bceModules = Object.entries(VEHICLE)
    .filter(([key]) => key.startsWith('BCE_MODULE'))
    .reduce(
      (acc, [_, moduleData]) => {
        if (!moduleData || !('DATA' in moduleData)) return acc;

        const typedModuleData = moduleData as Module;
        if (typedModuleData.DATA && Array.isArray(typedModuleData.DATA)) {
          typedModuleData.DATA.forEach((data: ModuleDataItem) => {
            const prefix = data['@_LABEL'].split('-')[0];
            const moduleInfo = getModuleInfo(data['@_LABEL']);

            if (!acc[prefix]) {
              acc[prefix] = {
                info: moduleInfo || {
                  longName: `Module ${prefix}`,
                  shortName: prefix,
                  prefix: prefix,
                },
                data: [],
              };
            }
            acc[prefix].data.push(data);
          });
        }
        return acc;
      },
      {} as Record<string, { info: ModuleInfo; data: ModuleDataItem[] }>
    );

  // Sort BCE modules by their long names
  const sortedBceModules = Object.entries(bceModules).sort((a, b) =>
    a[1].info.longName.localeCompare(b[1].info.longName)
  );

  // Sort node data by module names
  const sortedNodeData = [...nodeData].sort((a, b) =>
    getNodeModuleName(a.prefix).localeCompare(getNodeModuleName(b.prefix))
  );

  // Get errors if they exist
  const vehicleErrors = Array.isArray(VEHICLE.ERROR)
    ? VEHICLE.ERROR
    : VEHICLE.ERROR
      ? [VEHICLE.ERROR]
      : [];

  const rootErrors = Array.isArray(data.errors) ? data.errors : data.errors ? [data.errors] : [];

  const allErrors = [...vehicleErrors, ...rootErrors];

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.dark' }}>
        <Typography variant="h5" gutterBottom>
          VIN: {VEHICLE.VIN}
        </Typography>
      </Paper>

      {/* Display errors if any */}
      {allErrors.length > 0 && (
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'error.dark' }}>
          <Typography variant="h6" color="error.contrastText" gutterBottom>
            Errors Found
          </Typography>
          {allErrors.map((error: ErrorData, index: number) => (
            <Typography key={index} color="error.contrastText">
              {error['@_CODE'] || error.ERRORCODE}: {error['@_DESC'] || error.ERRORMSG}
            </Typography>
          ))}
        </Paper>
      )}

      {sortedNodeData.length > 0 && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Nodes</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Node ID</TableCell>
                    {fCodeArray.map(code => (
                      <TableCell key={code} title={getFCodeDescription(code)}>
                        {getFCodeDescription(code)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedNodeData.map((node, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{getNodeModuleName(node.prefix)}</TableCell>
                      {fCodeArray.map(code => (
                        <TableCell key={code}>{node.codes[code] || ''}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Grouped BCE Modules */}
      {sortedBceModules.map(([prefix, { info, data }]) => (
        <Accordion key={prefix} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              {info.longName} ({info.shortName})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Label</TableCell>
                    <TableCell>Code 1</TableCell>
                    <TableCell>Code 2</TableCell>
                    <TableCell>Code 3</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item['@_LABEL']}</TableCell>
                      {item.CODE && Array.isArray(item.CODE)
                        ? item.CODE.map((code: string, codeIndex: number) => (
                            <TableCell key={codeIndex}>{code}</TableCell>
                          ))
                        : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Other modules - sort them alphabetically */}
      {Object.entries(VEHICLE)
        .filter(
          ([key]) =>
            !key.startsWith('BCE_MODULE') &&
            key !== 'VIN' &&
            key !== 'VEHICLE_DATA' &&
            key !== 'NODEID'
        )
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([moduleName, moduleData]) => {
          if (!moduleData || !('DATA' in moduleData)) {
            return null;
          }

          const typedModuleData = moduleData as Module;

          return (
            <Accordion key={moduleName} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">{moduleName.replace('_', ' ')}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Label</TableCell>
                        <TableCell>Code 1</TableCell>
                        <TableCell>Code 2</TableCell>
                        <TableCell>Code 3</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {typedModuleData.DATA &&
                        Array.isArray(typedModuleData.DATA) &&
                        typedModuleData.DATA.map((data: ModuleDataItem, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{data['@_LABEL']}</TableCell>
                            <TableCell>
                              {data.CODE && Array.isArray(data.CODE)
                                ? data.CODE.map((code: string, codeIndex: number) => (
                                    <Box key={codeIndex} component="span" sx={{ mr: 1 }}>
                                      {code}
                                    </Box>
                                  ))
                                : null}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          );
        })}
    </Box>
  );
};
