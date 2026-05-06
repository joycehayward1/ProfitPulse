import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import AssessmentResultsPage from '../page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock Toast
const mockShowToast = jest.fn();
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// Mock InsForge
const mockDatabase = {
  from: jest.fn(),
};

jest.mock('@/lib/insforge', () => ({
  getInsForgeClient: jest.fn(() => ({
    database: mockDatabase,
  })),
}));

describe('AssessmentResultsPage', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it('should display loading state initially', () => {
    // Mock pending database call
    mockDatabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              single: jest.fn().mockReturnValue(
                new Promise(() => {}) // Never resolves
              ),
            }),
          }),
        }),
      }),
    });

    render(<AssessmentResultsPage />);

    expect(screen.getByText(/loading your breakdown/i)).toBeInTheDocument();
  });

  it('should display health score and breakdown for healthy business', async () => {
    const mockAssessment = {
      id: '123',
      user_id: 'placeholder-user-id',
      cash_on_hand: 60000,
      monthly_revenue: 20000,
      monthly_expenses: 10000,
      accounts_receivable: 0,
      health_score: 0,
      created_at: new Date().toISOString(),
    };

    mockDatabase.from.mockImplementation((table) => {
      if (table === 'health_assessments') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockAssessment,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        };
      }
      return mockDatabase;
    });

    render(<AssessmentResultsPage />);

    await waitFor(() => {
      expect(screen.getByText(/your business health score/i)).toBeInTheDocument();
    });

    // Check that gauge and badge are rendered (via role)
    expect(screen.getByRole('img', { name: /health score/i })).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();

    // Check breakdown sections (using getAllBy since text appears in both heading and description)
    expect(screen.getAllByText(/cash runway/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/profit margin/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/receivables health/i).length).toBeGreaterThan(0);

    // Check formula heading
    expect(screen.getByText(/here's how we calculated your score/i)).toBeInTheDocument();

    // Check continue button
    expect(screen.getByRole('button', { name: /continue to dashboard/i })).toBeInTheDocument();
  });

  it('should display "Attention" status for moderate scores', async () => {
    const mockAssessment = {
      id: '123',
      user_id: 'placeholder-user-id',
      cash_on_hand: 30000, // 3 months
      monthly_revenue: 15000,
      monthly_expenses: 10000,
      accounts_receivable: 5000,
      health_score: 0,
      created_at: new Date().toISOString(),
    };

    mockDatabase.from.mockImplementation((table) => {
      if (table === 'health_assessments') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockAssessment,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        };
      }
      return mockDatabase;
    });

    render(<AssessmentResultsPage />);

    await waitFor(() => {
      expect(screen.getByText('Attention')).toBeInTheDocument();
    });
  });

  it('should display "Critical" status for low scores', async () => {
    const mockAssessment = {
      id: '123',
      user_id: 'placeholder-user-id',
      cash_on_hand: 5000, // 0.5 months
      monthly_revenue: 10000,
      monthly_expenses: 12000, // Negative margin
      accounts_receivable: 8000,
      health_score: 0,
      created_at: new Date().toISOString(),
    };

    mockDatabase.from.mockImplementation((table) => {
      if (table === 'health_assessments') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockAssessment,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        };
      }
      return mockDatabase;
    });

    render(<AssessmentResultsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Critical').length).toBeGreaterThan(0);
    });
  });

  it('should redirect to assessment if no data found', async () => {
    mockDatabase.from.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      }),
    }));

    render(<AssessmentResultsPage />);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('error', expect.stringContaining('No assessment'));
      expect(mockPush).toHaveBeenCalledWith('/assessment');
    });
  });

  it('should redirect to assessment on database error', async () => {
    mockDatabase.from.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      }),
    }));

    render(<AssessmentResultsPage />);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('error', expect.stringContaining('No assessment'));
      expect(mockPush).toHaveBeenCalledWith('/assessment');
    });
  });

  it('should update assessment record with calculated score', async () => {
    const mockAssessment = {
      id: '123',
      user_id: 'placeholder-user-id',
      cash_on_hand: 60000,
      monthly_revenue: 20000,
      monthly_expenses: 10000,
      accounts_receivable: 0,
      health_score: 0,
      created_at: new Date().toISOString(),
    };

    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });

    mockDatabase.from.mockImplementation((table) => {
      if (table === 'health_assessments') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockAssessment,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: mockUpdate,
        };
      }
      return mockDatabase;
    });

    render(<AssessmentResultsPage />);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ health_score: expect.any(Number) });
    });
  });
});
