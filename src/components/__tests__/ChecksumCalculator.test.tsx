import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChecksumCalculator } from '../ChecksumCalculator';

describe('ChecksumCalculator', () => {
  it('calculates a checksum for a standard two-digit address', () => {
    render(<ChecksumCalculator />);

    fireEvent.change(screen.getByLabelText('Module ID (Required)'), {
      target: { value: '726-02-01' },
    });
    fireEvent.change(screen.getByLabelText('Code 1 (Required)'), {
      target: { value: '1E1E' },
    });
    fireEvent.change(screen.getByLabelText('Code 2 (Optional)'), {
      target: { value: '0000' },
    });
    fireEvent.change(screen.getByLabelText('Code 3 (Optional)'), {
      target: { value: '0000' },
    });

    fireEvent.click(screen.getByText('Calculate'));

    expect(screen.getByText('726-02-01 : [1E1E] [0000] [006C]')).toBeInTheDocument();
  });

  it('accepts a long final address segment', () => {
    render(<ChecksumCalculator />);

    fireEvent.change(screen.getByLabelText('Module ID (Required)'), {
      target: { value: '706-28-194' },
    });
    fireEvent.change(screen.getByLabelText('Code 1 (Required)'), {
      target: { value: '0000' },
    });

    expect(screen.getByText('Calculate')).not.toBeDisabled();

    fireEvent.click(screen.getByText('Calculate'));

    expect(screen.getByText('706-28-194 : [00EB] [] []')).toBeInTheDocument();
  });

  it('accepts a long middle address segment', () => {
    render(<ChecksumCalculator />);

    fireEvent.change(screen.getByLabelText('Module ID (Required)'), {
      target: { value: '726-101-01' },
    });
    fireEvent.change(screen.getByLabelText('Code 1 (Required)'), {
      target: { value: '1E1E' },
    });
    fireEvent.change(screen.getByLabelText('Code 2 (Optional)'), {
      target: { value: '0000' },
    });
    fireEvent.change(screen.getByLabelText('Code 3 (Optional)'), {
      target: { value: '0000' },
    });

    expect(screen.getByText('Calculate')).not.toBeDisabled();

    fireEvent.click(screen.getByText('Calculate'));

    expect(screen.getByText('726-101-01 : [1E1E] [0000] [00CF]')).toBeInTheDocument();
  });

  it('rejects address bytes above 255', () => {
    render(<ChecksumCalculator />);

    fireEvent.change(screen.getByLabelText('Module ID (Required)'), {
      target: { value: '726-256-01' },
    });
    fireEvent.change(screen.getByLabelText('Code 1 (Required)'), {
      target: { value: '1E1E' },
    });

    expect(screen.getByText('Calculate')).toBeDisabled();
    expect(
      screen.getByText('Format: HHH-N-N (HHH is hex, N is a decimal byte from 0-255)')
    ).toBeInTheDocument();
  });
});
