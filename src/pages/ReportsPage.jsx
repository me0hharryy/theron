import React from 'react';
import Card from '../components/ui/Card';

const ReportsPage = () => (
  <div className="space-y-6">
     {/* DIRECTLY APPLIED THEME: Dark and medium gray text */}
    <header>
      <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Reports</h1>
      <p className="mt-1 text-sm md:text-base text-[#6C757D]">View detailed business insights.</p>
    </header>
    <Card>
      <div className="flex h-64 items-center justify-center rounded-md border-2 border-dashed border-[#D3D0CB]"> {/* Light gray dashed border */}
        <div className="text-center">
             {/* Placeholder Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mx-auto h-12 w-12 text-[#D3D0CB]"> {/* Light Gray Icon */}
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
            <p className="mt-4 text-lg font-medium text-[#6C757D]">Reports Feature Coming Soon</p> {/* Medium Gray */}
            <p className="mt-1 text-sm text-[#6C757D]">Detailed analytics and downloadable reports are under development.</p> {/* Medium Gray */}
        </div>
      </div>
    </Card>
  </div>
);

export default ReportsPage;