
import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { User, CreditTransaction } from '@/api/entities';
import { createPaymentIntent } from '@/api/functions';
import { getStripePublishableKey } from '@/api/functions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, DollarSign, CheckCircle, Clock, CreditCard, RefreshCw, Info, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import pricingService from '@/services/pricingService';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';

const CheckoutForm = ({ selectedPackage, currency, storeId, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError('Payment system not ready. Please wait and try again.');
      return;
    }

    if (!storeId) {
      setError('Please select a store first.');
      return;
    }

    setProcessing(true);

    try {
      const intentResult = await createPaymentIntent({
        credits: selectedPackage.credits,
        amount: selectedPackage.price,
        store_id: storeId
      }, currency);

      const { data: response, error: intentError } = intentResult;

      if (intentError) {
        throw new Error(`Payment setup failed: ${intentError.message}`);
      }

      if (response?.error) {
        throw new Error(`Payment setup failed: ${response.error}`);
      }

      if (!response) {
        throw new Error('No response from payment service');
      }

      const clientSecret = response.data?.clientSecret || response.clientSecret;

      if (!clientSecret) {
        throw new Error('Invalid payment response - missing client secret');
      }

      const cardElement = elements.getElement(CardElement);

      const confirmResult = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        }
      });

      const { error: paymentError, paymentIntent } = confirmResult;

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      onSuccess();
    } catch (err) {
      setError(err.message);
      onError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Calculate total with tax
  const total = selectedPackage.total || (selectedPackage.price * 1.21);
  const taxPercentage = selectedPackage.tax_percentage || 21;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-900">
            Your credit card will be charged <strong>{currency === 'eur' ? '€' : '$'}{total.toFixed(2)}</strong> (incl. {taxPercentage}% BTW NL) when you submit the payment.
          </p>
        </div>
      </div>

      <div className="p-4 border rounded-lg bg-white">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
            },
          }}
        />
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full"
      >
        {processing ? (
            <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Processing...
            </>
        ) : `Pay ${pricingService.formatPrice(total, currency)}`}
      </Button>
    </form>
  );
};

export default function Billing() {
  const navigate = useNavigate();
  const { selectedStore } = useStoreSelection();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [stripeConfigError, setStripeConfigError] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('usd');
  const [creditOptions, setCreditOptions] = useState([]);
  const [currencies, setCurrencies] = useState(['usd', 'eur']);

  useEffect(() => {
    loadBillingData();
    loadCurrencies();
    loadPricing(selectedCurrency);

    const fetchKey = async () => {
        try {
            const result = await getStripePublishableKey();
            const { data } = result;

            if (data && data.publishableKey) {
                const stripeInstance = loadStripe(data.publishableKey);
                setStripePromise(stripeInstance);
                setStripeConfigError(false);
            } else {
                setStripeConfigError(true);
                // Set stripePromise to false (not null) to stop showing "Loading..."
                setStripePromise(false);
            }
        } catch (error) {
            console.error("Failed to fetch Stripe publishable key:", error);
            setStripeConfigError(true);
            // Set stripePromise to false (not null) to stop showing "Loading..."
            setStripePromise(false);
        }
    };
    fetchKey();
  }, []);

  const loadBillingData = async () => {
    setLoading(true);
    setPaymentError('');
    try {
      const userData = await User.me();
      setUser(userData);

      // Fetch transactions
      const transactionData = await CreditTransaction.findAll();
      setTransactions(Array.isArray(transactionData) ? transactionData : []);
    } catch (error) {
      console.error("Error loading billing data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load available currencies
  const loadCurrencies = async () => {
    try {
      const currencyList = await pricingService.getCurrencies();
      setCurrencies(currencyList);
    } catch (error) {
      console.error('Error loading currencies:', error);
      // Keep default currencies
    }
  };

  // Load pricing for selected currency
  const loadPricing = async (currency) => {
    try {
      const pricing = await pricingService.getPricing(currency);

      // Transform to match existing structure (map 'amount' to 'price')
      // Now includes tax info: subtotal, tax_amount, total, tax_rate, tax_percentage
      const transformedPricing = pricing.map(option => ({
        ...option,
        price: option.amount, // Backend uses 'amount', frontend expects 'price'
        stripe_price_id: option.stripe_price_id,
        // Tax fields are already included from backend
        subtotal: option.subtotal || option.amount,
        tax_amount: option.tax_amount || (option.amount * 0.21),
        total: option.total || (option.amount * 1.21),
        tax_percentage: option.tax_percentage || 21
      }));

      setCreditOptions(transformedPricing);
    } catch (error) {
      console.error('Error loading pricing:', error);
      // Set default pricing as fallback (now includes tax)
      setCreditOptions(pricingService.getDefaultPricing(currency).map(opt => ({
        ...opt,
        price: opt.amount
      })));
    }
  };

  // Reload pricing when currency changes
  useEffect(() => {
    if (selectedCurrency) {
      loadPricing(selectedCurrency);
      setSelectedPackage(null); // Reset selection when currency changes
    }
  }, [selectedCurrency]);

  const handlePaymentSuccess = async () => {
    setPaymentSuccess(true);
    setSelectedPackage(null);

    // Wait for backend to process the payment and update balance
    // Poll until balance is updated (max 10 attempts, 1 second apart)
    const previousBalance = user?.credits || 0;
    let attempts = 0;
    const maxAttempts = 10;

    const checkBalance = async () => {
      attempts++;
      try {
        const userData = await User.me();
        const newBalance = userData?.credits || 0;

        if (newBalance > previousBalance || attempts >= maxAttempts) {
          // Balance updated or max attempts reached
          setUser(userData);
          window.dispatchEvent(new CustomEvent('creditsUpdated'));

          // Also reload transactions
          const transactionData = await CreditTransaction.findAll();
          setTransactions(Array.isArray(transactionData) ? transactionData : []);

          // Hide success message after 5 seconds
          setTimeout(() => setPaymentSuccess(false), 5000);
        } else {
          // Balance not updated yet, try again
          setTimeout(checkBalance, 1000);
        }
      } catch (error) {
        console.error('Error checking balance:', error);
        if (attempts >= maxAttempts) {
          setTimeout(() => setPaymentSuccess(false), 5000);
        } else {
          setTimeout(checkBalance, 1000);
        }
      }
    };

    // Start polling after a short delay to let backend process
    setTimeout(checkBalance, 1500);
  };

  const handlePaymentError = (error) => {
    setPaymentError(error);
     setTimeout(() => {
        setPaymentError('');
    }, 8000);
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Billing & Credits</h1>
      </div>

      {paymentSuccess && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          Payment successful! Your credits have been added. The balance will update shortly.
        </div>
      )}

      {stripeConfigError && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-300 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-blue-900 font-medium">Stripe Payment Setup Required</p>
              <p className="text-blue-700 text-sm mt-1">
                To purchase credits and accept payments, you need to connect your Stripe account first.
              </p>
              <Button
                onClick={() => navigate(createPageUrl('Dashboard'))}
                variant="outline"
                size="sm"
                className="mt-3 border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                Go to Dashboard to Connect Stripe
              </Button>
            </div>
          </div>
        </div>
      )}

      {paymentError && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>Payment failed: {paymentError}</span>
        </div>
      )}
      
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Purchase Credits</CardTitle>
                  <CardDescription>
                    Your store uses 1 credit per day. Top up your balance to keep your store active.
                  </CardDescription>
                </div>

                {/* Currency Selector */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Currency:</label>
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {currencies.map(curr => (
                      <option key={curr} value={curr}>
                        {curr.toUpperCase()} ({pricingService.getCurrencySymbol(curr)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                {creditOptions.map(option => (
                  <Card key={option.price} className={`relative cursor-pointer transition-all hover:shadow-lg ${
                    option.popular ? 'border-blue-500 ring-2 ring-blue-500' : ''
                  } ${selectedPackage?.credits === option.credits ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelectedPackage(option)}>
                    {option.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        POPULAR
                      </div>
                    )}
                    <CardHeader className="text-center">
                      <CardTitle>{option.credits.toLocaleString()} Credits</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <p className="text-3xl font-bold mb-4">
                        {pricingService.formatPrice(option.price, selectedCurrency)}
                      </p>
                      <Button
                        className="w-full"
                        variant={selectedPackage?.credits === option.credits ? 'default' : 'outline'}
                      >
                        {selectedPackage?.credits === option.credits ? 'Selected' : 'Select'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p className="text-sm text-gray-500 text-center mt-4">
                All prices are excl. 21% BTW (NL)
              </p>

              {selectedPackage && (
                <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">
                    Complete Payment for {selectedPackage.credits} Credits
                  </h3>

                  {/* Price breakdown with tax */}
                  <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="space-y-2">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span>{pricingService.formatPrice(selectedPackage.subtotal || selectedPackage.price, selectedCurrency)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>BTW NL ({selectedPackage.tax_percentage || 21}%)</span>
                        <span>{pricingService.formatPrice(selectedPackage.tax_amount || (selectedPackage.price * 0.21), selectedCurrency)}</span>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between font-semibold text-lg">
                          <span>Total</span>
                          <span>{pricingService.formatPrice(selectedPackage.total || (selectedPackage.price * 1.21), selectedCurrency)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {stripeConfigError ? (
                     <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                       <div className="flex items-start gap-3">
                         <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                         <div className="flex-1">
                           <p className="text-yellow-900 font-medium">Stripe Payment Not Configured</p>
                           <p className="text-yellow-700 text-sm mt-1">
                             Payment processing is not available. Please ensure Stripe is properly configured on the server.
                           </p>
                         </div>
                       </div>
                     </div>
                  ) : stripePromise ? (
                     <Elements stripe={stripePromise}>
                       <CheckoutForm
                         selectedPackage={selectedPackage}
                         currency={selectedCurrency}
                         storeId={selectedStore?.id}
                         onSuccess={handlePaymentSuccess}
                         onError={handlePaymentError}
                       />
                     </Elements>
                  ) : (
                     <div className="text-center text-gray-500 flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 mr-2 animate-spin" />
                        <span>Loading payment form...</span>
                     </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Your Balance</CardTitle>
              <Wallet className="w-6 h-6 text-gray-400" />
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{user?.credits?.toLocaleString() || 0}</p>
              <p className="text-gray-600">Available Credits</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transactions.length > 0 ? transactions.slice(0, 5).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {tx.status === 'completed' ? 
                        <CheckCircle className="w-5 h-5 text-green-500" /> : 
                        <Clock className="w-5 h-5 text-yellow-500" />
                      }
                      <div>
                        <p className="font-medium">Purchased {tx.credits_amount} credits</p>
                        <p className="text-sm text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <p className="font-medium">${tx.amount_usd}</p>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500">No transactions yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
