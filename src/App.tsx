import React, { useState } from 'react';
import { Box, Container, Typography, Paper, Button, Link, Tabs, Tab } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import { XMLParser } from 'fast-xml-parser';
import { AsBuiltViewer } from './components/AsBuiltViewer';
import { AsBuiltComparer } from './components/AsBuiltComparer';
import { ChecksumCalculator } from './components/ChecksumCalculator';
import { AsBuiltData } from './types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [tabValue, setTabValue] = useState(0);
  const [asBuiltData, setAsBuiltData] = useState<AsBuiltData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if file has .ab extension
    if (!file.name.toLowerCase().endsWith('.ab')) {
      setError('Please select a valid AsBuilt file (.ab)');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = e.target?.result as string;
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_',
          numberParseOptions: {
            hex: false,
            leadingZeros: false,
          },
          preserveOrder: false,
          textNodeName: '#text',
        });
        const result = parser.parse(text);
        console.log('Parsed AsBuilt data:', result);
        setAsBuiltData(result);
        setError(null);
      } catch (err) {
        console.error('Error parsing AsBuilt file:', err);
        setError('Error parsing AsBuilt file. Please check the file format.');
      }
    };
    reader.onerror = () => {
      setError('Error reading file');
    };
    reader.readAsText(file);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="As-Built Viewer" />
          <Tab label="As-Built Comparer" />
          <Tab label="Checksum Calculator" />
        </Tabs>
      </Box>
      <TabPanel value={tabValue} index={0}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Button variant="contained" component="label" sx={{ minWidth: 200 }}>
              Select AsBuilt File
              <input type="file" hidden accept=".ab" onChange={handleFileUpload} />
            </Button>
            {error && (
              <Typography color="error" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
          </Box>
        </Paper>
        <AsBuiltViewer data={asBuiltData} />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <AsBuiltComparer />
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        <ChecksumCalculator />
      </TabPanel>
      <Box
        component="footer"
        sx={{
          mt: 4,
          py: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Link
          href="https://github.com/carp3/AsBuilt-Browser"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary',
            },
          }}
        >
          <GitHubIcon sx={{ mr: 0.5 }} />
          <Typography variant="body2">carp3/AsBuilt-Browser</Typography>
        </Link>
      </Box>
    </Container>
  );
}

export default App;
