import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, Grid } from '@mui/material';

export const ChecksumCalculator: React.FC = () => {
  const [moduleId, setModuleId] = useState('');
  const [code1, setCode1] = useState('');
  const [code2, setCode2] = useState('');
  const [code3, setCode3] = useState('');
  const [result, setResult] = useState('');

  const validateHex = (value: string): boolean => {
    return /^[0-9A-Fa-f]{0,4}$/.test(value);
  };

  const validateModuleId = (value: string): boolean => {
    // Format: HHH-XX-XX where HHH is hex and XX is numeric
    return /^[0-9A-Fa-f]{3}-[0-9]{2}-[0-9]{2}$/.test(value);
  };

  const handleModuleIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase();
    // Allow input up to 9 characters (3 hex + 2 dashes + 2 digits + 2 digits)
    if (value.length <= 9) {
      // Only allow hex characters before the first dash
      const parts = value.split('-');
      if (parts.length === 1) {
        if (/^[0-9A-F]{0,3}$/.test(value)) {
          setModuleId(value);
        }
      } else if (parts.length === 2) {
        if (/^[0-9A-F]{3}$/.test(parts[0]) && /^[0-9]{0,2}$/.test(parts[1])) {
          setModuleId(value);
        }
      } else if (parts.length === 3) {
        if (
          /^[0-9A-F]{3}$/.test(parts[0]) &&
          /^[0-9]{2}$/.test(parts[1]) &&
          /^[0-9]{0,2}$/.test(parts[2])
        ) {
          setModuleId(value);
        }
      }
    }
  };

  const handleCode1Change = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase();
    if (validateHex(value)) {
      setCode1(value);
    }
  };

  const handleCode2Change = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase();
    if (validateHex(value)) {
      setCode2(value);
    }
  };

  const handleCode3Change = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase();
    if (validateHex(value)) {
      setCode3(value);
    }
  };

  const calculateChecksum = () => {
    if (!validateModuleId(moduleId)) {
      setResult('Invalid Module ID format (HHH-XX-XX)');
      return;
    }

    if (code1.length !== 4) {
      setResult('Code 1 must be 4 characters long');
      return;
    }

    // Convert Module ID to bytes (right to left)
    const [hhh, xx1, xx2] = moduleId.split('-');
    const moduleIdBytes = [
      parseInt(xx2, 10).toString(16).padStart(2, '0'),
      parseInt(xx1, 10).toString(16).padStart(2, '0'),
      hhh.slice(1, 3),
      hhh.slice(0, 1),
    ];

    // Add all bytes first
    const allBytes = [...moduleIdBytes];

    // Add all bytes of Code 1
    allBytes.push(code1.slice(0, 2), code1.slice(2, 4));

    if (code2) {
      allBytes.push(code2.slice(0, 2), code2.slice(2, 4));
    }

    if (code3) {
      allBytes.push(code3.slice(0, 2), code3.slice(2, 4));
    }

    // Remove the last byte
    allBytes.pop();

    // Calculate checksum (sum of all bytes, take last 8 bits)
    const sum = allBytes.reduce((acc, byte) => {
      return acc + parseInt(byte, 16);
    }, 0);
    const checksum = (sum & 0xff).toString(16).toUpperCase().padStart(2, '0');

    // Format result in DWORD notation using original input codes
    let dword1 = code1;
    let dword2 = code2 || '';
    let dword3 = code3 || '';

    // Replace the last byte of the last non-empty code with checksum
    if (code3) {
      dword3 = code3.slice(0, 2) + checksum;
    } else if (code2) {
      dword2 = code2.slice(0, 2) + checksum;
    } else if (code1) {
      dword1 = code1.slice(0, 2) + checksum;
    }

    setResult(`${moduleId} : [${dword1}] [${dword2}] [${dword3}]`);
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Checksum Calculator
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Module ID (Required)"
              value={moduleId}
              onChange={handleModuleIdChange}
              error={moduleId.length > 0 && !validateModuleId(moduleId)}
              helperText={
                moduleId.length > 0 && !validateModuleId(moduleId)
                  ? 'Format: HHH-XX-XX (HHH is hex, XX is numeric)'
                  : ''
              }
              placeholder="HHH-XX-XX"
              inputProps={{ maxLength: 9 }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Code 1 (Required)"
              value={code1}
              onChange={handleCode1Change}
              error={code1.length > 0 && code1.length !== 4}
              helperText={code1.length > 0 && code1.length !== 4 ? 'Must be 4 characters' : ''}
              inputProps={{ maxLength: 4 }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Code 2 (Optional)"
              value={code2}
              onChange={handleCode2Change}
              inputProps={{ maxLength: 4 }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Code 3 (Optional)"
              value={code3}
              onChange={handleCode3Change}
              inputProps={{ maxLength: 4 }}
            />
          </Grid>
        </Grid>
        <Button
          variant="contained"
          onClick={calculateChecksum}
          disabled={!validateModuleId(moduleId) || code1.length !== 4}
        >
          Calculate
        </Button>
        {result && (
          <>
            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
              Code data with the correct checksum:
            </Typography>
            <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
              {result}
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
};
