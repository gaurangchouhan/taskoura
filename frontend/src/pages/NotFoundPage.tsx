import React from 'react';
import { Link } from 'react-router-dom';
import { FolderGit2, ArrowRight } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/60 via-[#f8fafc] to-white flex flex-col justify-between">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-28">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-sky-500/5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-3 shadow-md shadow-sky-500/20">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            404
          </h1>
          <h2 className="text-lg font-bold text-slate-800 mb-1">
            Page Not Found
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            The workspace or screen you are attempting to access does not exist or has moved.
          </p>

          <Link
            to="/"
            className="w-full py-3 px-5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <span>Return to Taskoura Home</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
};
