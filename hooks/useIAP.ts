import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

// expo-iap requires a development build, not Expo Go
let ExpoIAP: any = null;
let IAP_AVAILABLE = false;
try {
  ExpoIAP = require('expo-iap');
  IAP_AVAILABLE = true;
} catch (e) {
  console.log('expo-iap not available (requires development build)');
}

export type TokenPackage = {
  id: string;
  productId: string;
  name: string;
  tokens: number;
  price: string;
  priceValue: number;
  popular?: boolean;
  bestValue?: boolean;
};

// Product IDs - must match App Store Connect / Google Play Console
const PRODUCT_IDS = Platform.select({
  ios: [
    'com.oomf.tokens.starter',
    'com.oomf.tokens.popular',
    'com.oomf.tokens.best',
    'com.oomf.tokens.mega',
  ],
  android: [
    'tokens_starter',
    'tokens_popular',
    'tokens_best',
    'tokens_mega',
  ],
  default: [],
});

// Fallback packages if store isn't available
const FALLBACK_PACKAGES: TokenPackage[] = [
  {
    id: 'starter',
    productId: Platform.OS === 'ios' ? 'com.oomf.tokens.starter' : 'tokens_starter',
    name: 'Starter',
    tokens: 5,
    price: '$0.99',
    priceValue: 0.99,
  },
  {
    id: 'popular',
    productId: Platform.OS === 'ios' ? 'com.oomf.tokens.popular' : 'tokens_popular',
    name: 'Popular',
    tokens: 20,
    price: '$2.99',
    priceValue: 2.99,
    popular: true,
  },
  {
    id: 'best',
    productId: Platform.OS === 'ios' ? 'com.oomf.tokens.best' : 'tokens_best',
    name: 'Best Value',
    tokens: 40,
    price: '$4.99',
    priceValue: 4.99,
    bestValue: true,
  },
  {
    id: 'mega',
    productId: Platform.OS === 'ios' ? 'com.oomf.tokens.mega' : 'tokens_mega',
    name: 'Mega Pack',
    tokens: 100,
    price: '$9.99',
    priceValue: 9.99,
  },
];

export function useIAP() {
  const { user, fetchUserProfile } = useAuthStore();
  const [packages, setPackages] = useState<TokenPackage[]>(FALLBACK_PACKAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize IAP connection
  const initializeIAP = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if IAP is available (requires development build)
      if (!IAP_AVAILABLE || !ExpoIAP) {
        console.log('IAP: Not available in Expo Go, using fallback packages');
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      // Connect to store
      const connected = await ExpoIAP.initConnection();
      if (!connected) {
        console.log('IAP: Store not available, using fallback packages');
        setIsInitialized(true);
        return;
      }

      // Get products from store
      if (PRODUCT_IDS && PRODUCT_IDS.length > 0) {
        const products = await ExpoIAP.getProducts(PRODUCT_IDS);

        if (products && products.length > 0) {
          const storePackages: TokenPackage[] = products.map((product: any) => {
            // Parse tokens from product ID
            let tokens = 5;
            let popular = false;
            let bestValue = false;

            if (product.productId.includes('popular')) {
              tokens = 20;
              popular = true;
            } else if (product.productId.includes('best')) {
              tokens = 40;
              bestValue = true;
            } else if (product.productId.includes('mega')) {
              tokens = 100;
            }

            return {
              id: product.productId,
              productId: product.productId,
              name: product.title || `${tokens} Tokens`,
              tokens,
              price: product.localizedPrice || `$${(tokens * 0.2).toFixed(2)}`,
              priceValue: parseFloat(product.price) || tokens * 0.2,
              popular,
              bestValue,
            };
          });

          setPackages(storePackages.sort((a, b) => a.tokens - b.tokens));
        }
      }

      setIsInitialized(true);
    } catch (err: any) {
      console.error('IAP initialization error:', err);
      setError(err.message);
      // Use fallback packages on error
      setIsInitialized(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Purchase a token package
  const purchaseTokens = useCallback(async (packageItem: TokenPackage): Promise<boolean> => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to purchase tokens');
      return false;
    }

    if (!IAP_AVAILABLE || !ExpoIAP) {
      Alert.alert(
        'Not Available',
        'In-app purchases require a development build. This feature is not available in Expo Go.',
        [{ text: 'OK' }]
      );
      return false;
    }

    setIsPurchasing(true);
    setError(null);

    try {
      // Create pending purchase record in database
      const { data: purchaseRecord, error: dbError } = await supabase
        .from('token_purchases')
        .insert({
          user_id: user.id,
          product_id: packageItem.productId,
          tokens_amount: packageItem.tokens,
          price_usd: packageItem.priceValue,
          platform: Platform.OS,
          status: 'pending',
        })
        .select('id')
        .single();

      if (dbError) {
        throw new Error('Failed to create purchase record');
      }

      // Request purchase from store
      const purchase = await ExpoIAP.requestPurchase(packageItem.productId);

      if (purchase) {
        // Complete the purchase in our database
        const { data: result, error: completeError } = await supabase.rpc(
          'complete_token_purchase' as any,
          {
            p_purchase_id: purchaseRecord.id,
            p_transaction_id: purchase.transactionId || purchase.transactionReceipt,
          }
        );

        if (completeError) {
          // Manual fallback
          await supabase
            .from('token_purchases')
            .update({
              status: 'completed',
              transaction_id: purchase.transactionId,
              completed_at: new Date().toISOString(),
            })
            .eq('id', purchaseRecord.id);

          await supabase
            .from('users')
            .update({ tokens: (user.tokens || 0) + packageItem.tokens })
            .eq('id', user.id);
        }

        // Finish the transaction (required by stores)
        await ExpoIAP.finishTransaction(purchase, false);

        // Refresh user profile to get updated token count
        await fetchUserProfile();

        Alert.alert(
          'Purchase Complete!',
          `You received ${packageItem.tokens} tokens!`,
          [{ text: 'OK' }]
        );

        return true;
      }

      // Purchase was cancelled or failed
      await supabase
        .from('token_purchases')
        .update({ status: 'failed' })
        .eq('id', purchaseRecord.id);

      return false;
    } catch (err: any) {
      console.error('Purchase error:', err);

      // Check if user cancelled
      if (err.code === 'E_USER_CANCELLED' || err.message?.includes('cancelled')) {
        // User cancelled, not an error
        return false;
      }

      setError(err.message);
      Alert.alert('Purchase Failed', err.message || 'Something went wrong. Please try again.');
      return false;
    } finally {
      setIsPurchasing(false);
    }
  }, [user, fetchUserProfile]);

  // Restore previous purchases
  const restorePurchases = useCallback(async (): Promise<void> => {
    if (!IAP_AVAILABLE || !ExpoIAP) {
      Alert.alert(
        'Not Available',
        'Restore purchases requires a development build. This feature is not available in Expo Go.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsLoading(true);
      const purchases = await ExpoIAP.getAvailablePurchases();

      if (purchases && purchases.length > 0) {
        Alert.alert('Restored', `Found ${purchases.length} previous purchase(s).`);
      } else {
        Alert.alert('No Purchases', 'No previous purchases found to restore.');
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeIAP();

    // Cleanup on unmount
    return () => {
      if (IAP_AVAILABLE && ExpoIAP) {
        ExpoIAP.endConnection();
      }
    };
  }, [initializeIAP]);

  return {
    packages,
    isLoading,
    isPurchasing,
    isInitialized,
    error,
    purchaseTokens,
    restorePurchases,
  };
}
