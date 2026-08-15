import React, { createContext, useContext, useState, useEffect } from 'react';
import { schoolService } from '../services/schoolService';

const AcademicYearContext = createContext(null);

export const AcademicYearProvider = ({ children }) => {
  const [academicYears, setAcademicYears] = useState([]);
  const [currentYear, setCurrentYear] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadYears = async (forceSetId = null) => {
    try {
      const list = await schoolService.getAcademicYears();
      const sorted = (list || []).sort((a, b) => {
        if (a.status === 'ACTIVE') return -1;
        if (b.status === 'ACTIVE') return 1;
        if (a.status === 'Archived' && b.status === 'Archived') {
          return b.name.localeCompare(a.name);
        }
        return 0;
      });
      
      setAcademicYears(sorted);

      const role = localStorage.getItem('shiksha_pilot_role');
      const isAdmin = role === 'SCHOOL_ADMIN' || role === 'SUPER_ADMIN';
      const savedId = isAdmin ? (forceSetId || localStorage.getItem('shiksha_pilot_academic_year_id')) : null;
      let target = null;
      
      if (savedId) {
        target = sorted.find(y => String(y.id) === String(savedId));
      }
      
      if (!target) {
        target = sorted.find(y => y.status === 'ACTIVE' || y.is_current === 1);
      }
      
      if (!target && sorted.length > 0) {
        target = sorted[0];
      }

      if (target) {
        setCurrentYear(target);
        if (isAdmin) {
          localStorage.setItem('shiksha_pilot_academic_year_id', String(target.id));
        } else {
          localStorage.removeItem('shiksha_pilot_academic_year_id');
        }
      } else {
        setCurrentYear(null);
        localStorage.removeItem('shiksha_pilot_academic_year_id');
      }
    } catch (err) {
      console.error('Failed to load academic years in context', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleAuthChange = () => {
      const token = localStorage.getItem('shiksha_pilot_token');
      const role = localStorage.getItem('shiksha_pilot_role');
      if (token && role && role !== 'SUPER_ADMIN') {
        setLoading(true);
        loadYears();
      } else {
        setAcademicYears([]);
        setCurrentYear(null);
        setLoading(false);
      }
    };

    handleAuthChange();

    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  const selectYear = (yearId) => {
    const role = localStorage.getItem('shiksha_pilot_role');
    if (role !== 'SCHOOL_ADMIN' && role !== 'SUPER_ADMIN') return;
    const target = academicYears.find(y => String(y.id) === String(yearId));
    if (target) {
      setCurrentYear(target);
      localStorage.setItem('shiksha_pilot_academic_year_id', String(target.id));
      window.dispatchEvent(new CustomEvent('academic-year-switched', { detail: target }));
    }
  };

  const isReadOnly = currentYear?.status === 'Archived';
  const isDraft = false;
  const isCurrent = currentYear?.is_current === 1 || currentYear?.status === 'ACTIVE';

  return (
    <AcademicYearContext.Provider
      value={{
        academicYears,
        currentYear,
        selectYear,
        loading,
        isReadOnly,
        isDraft,
        isCurrent,
        refreshYears: loadYears
      }}
    >
      {children}
    </AcademicYearContext.Provider>
  );
};

export const useAcademicYear = () => {
  const context = useContext(AcademicYearContext);
  if (!context) {
    throw new Error('useAcademicYear must be used within an AcademicYearProvider');
  }
  return context;
};
