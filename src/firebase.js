import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA_oGqXAa3GzXhSJ6FQhsANSM0Jy-f5Wjk',
  authDomain: 'expense-tracker-fd492.firebaseapp.com',
  projectId: 'expense-tracker-fd492',
  storageBucket: 'expense-tracker-fd492.firebasestorage.app',
  messagingSenderId: '449622517439',
  appId: '1:449622517439:web:80bc8c1d96ec28b7ff080a',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
