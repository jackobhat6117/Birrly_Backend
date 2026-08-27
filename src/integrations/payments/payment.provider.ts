export type PaymentResult = {
  providerPaymentId: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
};

export type PaymentVerification = {
  providerPaymentId: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
};

export interface PaymentProvider {
  createPayment(input: {
    userId: string;
    amount: string;
    currency: string;
    idempotencyKey: string;
  }): Promise<PaymentResult>;
  verifyPayment(providerPaymentId: string): Promise<PaymentVerification>;
}

export class UnconfiguredPaymentProvider implements PaymentProvider {
  createPayment(): Promise<PaymentResult> {
    return Promise.reject(new Error('Payment provider is not configured.'));
  }

  verifyPayment(): Promise<PaymentVerification> {
    return Promise.reject(new Error('Payment provider is not configured.'));
  }
}
