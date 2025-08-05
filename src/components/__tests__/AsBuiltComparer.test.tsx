import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AsBuiltComparer } from '../AsBuiltComparer';
import { XMLParser } from 'fast-xml-parser';
import { jest } from '@jest/globals';

// Mock XML files
const mockFile1 = new File(
  [
    `<?xml version="1.0" encoding="UTF-8"?>
    <AS_BUILT_DATA>
      <VEHICLE VIN="TEST123">
        <NODEID>07C4</NODEID>
        <F113>JX7T-14C689-AE</F113>
        <BCE_MODULE>
          <DATA LABEL="07C-01-01">
            <CODE>8A6A</CODE>
            <CODE>0592</CODE>
            <CODE>50B4</CODE>
          </DATA>
        </BCE_MODULE>
      </VEHICLE>
    </AS_BUILT_DATA>`,
  ],
  'test1.ab',
  { type: 'text/xml' }
);

const mockFile2 = new File(
  [
    `<?xml version="1.0" encoding="UTF-8"?>
    <AS_BUILT_DATA>
      <VEHICLE VIN="TEST456">
        <NODEID>07C4</NODEID>
        <F113>JX7T-14C689-BE</F113>
        <BCE_MODULE>
          <DATA LABEL="07C-01-01">
            <CODE>8A6A</CODE>
            <CODE>0592</CODE>
            <CODE>50B5</CODE>
          </DATA>
        </BCE_MODULE>
      </VEHICLE>
    </AS_BUILT_DATA>`,
  ],
  'test2.ab',
  { type: 'text/xml' }
);

// Mock XMLParser
const mockParse = jest.fn((xml: string) => {
  if (xml.includes('invalid xml content')) {
    throw new Error('Invalid XML');
  }
  return {
    AS_BUILT_DATA: {
      VEHICLE: {
        '@_VIN': xml.includes('TEST123') ? 'TEST123' : 'TEST456',
        NODEID: '07C4',
        F113: xml.includes('TEST123') ? 'JX7T-14C689-AE' : 'JX7T-14C689-BE',
        BCE_MODULE: {
          DATA: {
            '@_LABEL': '07C-01-01',
            CODE: ['8A6A', '0592', xml.includes('TEST123') ? '50B4' : '50B5'],
          },
        },
      },
    },
  };
});

jest.mock('fast-xml-parser', () => ({
  XMLParser: jest.fn().mockImplementation(() => ({
    parse: mockParse,
  })),
}));

describe('AsBuiltComparer', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('renders file upload buttons and compare button', () => {
    render(<AsBuiltComparer />);

    expect(screen.getByText('Select Car 1')).toBeInTheDocument();
    expect(screen.getByText('Select Car 2')).toBeInTheDocument();
    expect(screen.getByText('Compare Files')).toBeInTheDocument();
  });

  it('handles file uploads correctly', async () => {
    render(<AsBuiltComparer />);

    const file1Input = screen.getByLabelText('Select Car 1');
    const file2Input = screen.getByLabelText('Select Car 2');

    fireEvent.change(file1Input, { target: { files: [mockFile1] } });
    fireEvent.change(file2Input, { target: { files: [mockFile2] } });

    await waitFor(() => {
      expect(screen.getByText('Compare Files')).not.toBeDisabled();
    });
  });

  it('compares files and shows differences', async () => {
    render(<AsBuiltComparer />);

    // Upload files
    const file1Input = screen.getByLabelText('Select Car 1');
    const file2Input = screen.getByLabelText('Select Car 2');

    fireEvent.change(file1Input, { target: { files: [mockFile1] } });
    fireEvent.change(file2Input, { target: { files: [mockFile2] } });

    // Click compare button
    const compareButton = screen.getByText('Compare Files');
    fireEvent.click(compareButton);

    // Wait for comparison results
    await waitFor(() => {
      expect(screen.getByText('Car 1 VIN: TEST123')).toBeInTheDocument();
      expect(screen.getByText('Car 2 VIN: TEST456')).toBeInTheDocument();
    });

    // Check if module differences are shown
    await waitFor(() => {
      expect(screen.getByText(/BCE/)).toBeInTheDocument();
    });
  });

  it('handles part number comparison correctly', async () => {
    render(<AsBuiltComparer />);

    // Upload files
    const file1Input = screen.getByLabelText('Select Car 1');
    const file2Input = screen.getByLabelText('Select Car 2');

    fireEvent.change(file1Input, { target: { files: [mockFile1] } });
    fireEvent.change(file2Input, { target: { files: [mockFile2] } });

    // Click compare button
    const compareButton = screen.getByText('Compare Files');
    fireEvent.click(compareButton);

    // Wait for comparison results and expand the module
    await waitFor(() => {
      const moduleAccordion = screen.getByText(/BCE/);
      fireEvent.click(moduleAccordion);
    });

    // Check part numbers
    await waitFor(() => {
      expect(screen.getByText('JX7T-14C689-AE')).toBeInTheDocument();
      expect(screen.getByText('JX7T-14C689-BE')).toBeInTheDocument();
    });
  });

  it('handles identical part numbers correctly', async () => {
    // Create a copy of mockFile2 with the same part number as mockFile1
    const identicalFile2 = new File(
      [
        `<?xml version="1.0" encoding="UTF-8"?>
        <AS_BUILT_DATA>
          <VEHICLE VIN="TEST456">
            <NODEID>07C4</NODEID>
            <F113>JX7T-14C689-AE</F113>
            <BCE_MODULE>
              <DATA LABEL="07C-01-01">
                <CODE>8A6A</CODE>
                <CODE>0592</CODE>
                <CODE>50B4</CODE>
              </DATA>
            </BCE_MODULE>
          </VEHICLE>
        </AS_BUILT_DATA>`,
      ],
      'test2.ab',
      { type: 'text/xml' }
    );

    render(<AsBuiltComparer />);

    // Upload files
    const file1Input = screen.getByLabelText('Select Car 1');
    const file2Input = screen.getByLabelText('Select Car 2');

    fireEvent.change(file1Input, { target: { files: [mockFile1] } });
    fireEvent.change(file2Input, { target: { files: [identicalFile2] } });

    // Click compare button
    const compareButton = screen.getByText('Compare Files');
    fireEvent.click(compareButton);

    // Wait for comparison results and expand the module
    await waitFor(() => {
      const moduleAccordion = screen.getByText(/BCE/);
      fireEvent.click(moduleAccordion);
    });

    // Check if part numbers are marked as identical
    await waitFor(() => {
      const partNumberElement = screen.getByText(/JX7T-14C689-AE/);
      expect(partNumberElement).toHaveStyle({ color: 'success.main' });
    });
  });

  it('handles invalid XML files gracefully', async () => {
    const invalidFile = new File(['invalid xml content'], 'invalid.ab', { type: 'text/xml' });

    render(<AsBuiltComparer />);

    const file1Input = screen.getByLabelText('Select Car 1');
    fireEvent.change(file1Input, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Error parsing file/)).toBeInTheDocument();
    });
  });
});
