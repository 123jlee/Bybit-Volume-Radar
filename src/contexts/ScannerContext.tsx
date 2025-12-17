import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Scanner } from '../services/scanner';

interface ScannerContextType {
    isScanning: boolean;
    nextUpdate: number;
    startScanner: () => void;
    stopScanner: () => void;
}

const ScannerContext = createContext<ScannerContextType | undefined>(undefined);

export const ScannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [nextUpdate, setNextUpdate] = useState(60);
    const timerRef = useRef<any>(null);

    // Sync initial state
    useEffect(() => {
        setIsScanning(Scanner.getStatus());
    }, []);

    // Timer Logic
    useEffect(() => {
        if (isScanning) {
            timerRef.current = setInterval(() => {
                setNextUpdate(prev => {
                    if (prev <= 1) return 60;
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setNextUpdate(60);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isScanning]);

    const startScanner = () => {
        Scanner.start();
        setIsScanning(true);
        setNextUpdate(60); // Reset timer on fresh start
    };

    const stopScanner = () => {
        Scanner.stop();
        setIsScanning(false);
        setNextUpdate(60);
    };

    return (
        <ScannerContext.Provider value={{ isScanning, nextUpdate, startScanner, stopScanner }}>
            {children}
        </ScannerContext.Provider>
    );
};

export const useScanner = () => {
    const context = useContext(ScannerContext);
    if (!context) {
        throw new Error('useScanner must be used within a ScannerProvider');
    }
    return context;
};
