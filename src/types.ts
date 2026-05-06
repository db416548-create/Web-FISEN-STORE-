/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discount?: number;
  image?: string;
  category: string;
  sellerId?: string; // UID of the seller
  sellerType?: 'owner' | 'partner';
  isHidden?: boolean;
  rating?: number;
  reviewCount?: number;
  originalPrice?: number;
  discountPercentage?: number;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
  role?: string;
  userCode?: string;
}

export interface GameKey {
  id: string;
  productId: string;
  key: string;
  status: 'available' | 'sold';
  soldTo?: string;
  soldToWA?: string;
  soldAt?: any;
  sellerId?: string;
}

export interface Transaction {
  id: string;
  productId: string;
  productName: string;
  amount: number;
  customerEmail: string;
  customerWA?: string;
  status: 'pending' | 'completed' | 'failed';
  keyDelivered?: string;
  method?: string;
  createdAt: any;
  sellerId?: string;
  sellerType?: 'owner' | 'partner';
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  whatsapp?: string;
  userCode?: string;
  role: 'customer' | 'reseller' | 'partner' | 'admin';
  balance: number;
  partnerInfo?: {
    storeName: string;
    paymentQR?: string; // Custom QRIS URL
    paymentMethodName?: string; // e.g. "Dana", "OVO"
  };
}

export interface Deposit {
  id: string;
  userId: string;
  amount: number;
  method: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: any;
  expiresAt: any;
}

export interface AppSettings {
  contactWA: string;
  contactTelegram: string;
  contactEmail: string;
  ownerName: string;
}
