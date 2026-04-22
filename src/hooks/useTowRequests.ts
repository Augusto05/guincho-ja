import { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  setDoc,
  doc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TowRequest, RequestStatus } from '../types';

export function useTowRequests(role: 'customer' | 'driver', userId: string) {
  const [requests, setRequests] = useState<TowRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId === 'anonymous') {
      setRequests([]);
      setLoading(false);
      return;
    }

    // For drivers, we want to see all 'pending' requests nearby AND requests they've accepted
    const q = role === 'driver' 
      ? query(collection(db, 'towRequests'), where('status', 'in', ['pending', 'accepted', 'in_progress', 'completed', 'cancelled']), orderBy('createdAt', 'desc'))
      : query(collection(db, 'towRequests'), where('customerId', '==', userId), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TowRequest[];
      setRequests(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role, userId]);

  const createRequest = async (requestData: Partial<TowRequest>) => {
    try {
      const code = Math.random().toString(36).substring(2, 6).toUpperCase();
      await addDoc(collection(db, 'towRequests'), {
        ...requestData,
        securityCode: code,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  const updateRequestStatus = async (requestId: string, status: RequestStatus, driverId?: string) => {
    const requestRef = doc(db, 'towRequests', requestId);
    const updateData: any = { 
      status, 
      updatedAt: serverTimestamp() 
    };
    if (driverId) updateData.driverId = driverId;
    
    await updateDoc(requestRef, updateData);
  };

  const updateRequestDriverLocation = async (requestId: string, lat: number, lng: number) => {
    const requestRef = doc(db, 'towRequests', requestId);
    await updateDoc(requestRef, {
      driverLocation: { lat, lng },
      updatedAt: serverTimestamp()
    });
  };

  const deleteRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'towRequests', requestId), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error cancelling document: ", e);
    }
  };

  const updateDriverLocation = async (lat: number, lng: number) => {
    if (role === 'driver' && userId !== 'anonymous') {
      try {
        await setDoc(doc(db, 'driverStatus', userId), {
          lat,
          lng,
          isOnline: true,
          lastActive: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error("Error updating location:", e);
      }
    }
  };

  return { requests, loading, createRequest, updateRequestStatus, updateRequestDriverLocation, deleteRequest, updateDriverLocation };
}
