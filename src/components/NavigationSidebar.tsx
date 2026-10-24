/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Send, 
  Search, 
  GraduationCap, 
  Settings, 
  X, 
  Sparkles, 
  BookCheck, 
  Lock 
} from 'lucide-react';
import { ActiveTab, Submission } from '../types';
import { FOOTER_CREDIT } from '../constants';

interface Props {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  submissions: Submission[];
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isAdminAuthenticated: boolean;
  onRequestAdminAuth: () => Promise<void>;
}

export default function NavigationSidebar({
  activeTab,
  onTabChange,
  submissions,
  isMobileOpen,
  setIsMobileOpen,
  isAdminAuthenticated,
  onRequestAdminAuth,
}: Props) {
  const handleTabClick = async (tab: ActiveTab) => {
    if (tab === 'admin' && !isAdminAuthenticated) {
      await onRequestAdminAuth();
      return;
    }
    onTabChange(tab);
    setIsMobileOpen(false);
  };

  const navItems = [
    {
      id: 'submit' as ActiveTab,
      label: '1. หน้าส่งงาน',
      emoji: '🎒',
      sublabel: 'สำหรับนักเรียนส่งผลงาน ✨',
      icon: Send,
      badgeColor: 'bg-indigo-100 text-indigo-700',
    },
    {
      id: 'status' as ActiveTab,
      label: '2. ตรวจสอบสถานะการส่งงาน',
      emoji: '🔍',
      sublabel: 'ค้นหาคะแนนรายบุคคล 🎯',
      icon: Search,
      badgeColor: 'bg-emerald-100 text-emerald-700',
    },
    {
      id: 'teacher' as ActiveTab,
      label: '3. หน้าสำหรับครูผู้สอน',
      emoji: '👩‍🏫',
      sublabel: 'ลงทะเบียน • ตรวจงาน 📝',
      icon: GraduationCap,
      badgeColor: 'bg-purple-100 text-purple-700',
    },
    {
      id: 'admin' as ActiveTab,
      label: '4. ตั้งค่าระบบ (Google Sheet)',
      emoji: '⚙️',
      sublabel: 'เชื่อมต่อชีต & จัดการข้อมูล 🔒',
      icon: Settings,
      badgeColor: 'bg-amber-100 text-amber-700',
      locked: !isAdminAuthenticated,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-gradient-to-b from-white/95 via-purple-50/40 to-indigo-50/40 backdrop-blur-md border-r border-purple-100/70 shadow-xl">
      {/* App Branding Header */}
      <div className="p-5 border-b border-purple-100/70 flex items-center justify-between bg-white/70">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-violet-500 via-indigo-500 to-pink-500 text-white flex items-center justify-center shadow-md shadow-purple-200 text-xl">
            ✨
          </div>
          <div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 uppercase tracking-wider bg-violet-100/80 px-2 py-0.5 rounded-full">
              🏫 โรงเรียนท่าบ่อ
            </div>
            <h1 className="text-sm font-extrabold text-gray-900 leading-tight mt-1">
              ระบบตรวจงานให้คะแนน ออนไลน์
            </h1>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-purple-50 cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation Menu List */}
      <div className="p-4 flex-1 space-y-2.5 overflow-y-auto">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-[10px] font-bold text-violet-600/90 uppercase tracking-widest flex items-center gap-1">
            🌟 เมนูหลักของระบบ
          </span>
          <span className="text-[10px] bg-pink-100 text-pink-700 font-semibold px-2 py-0.5 rounded-full">
            Online v2.0
          </span>
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full p-3 rounded-2xl text-left transition-all flex items-center gap-3 cursor-pointer group border ${
                isActive
                  ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white border-transparent shadow-lg shadow-purple-200/80'
                  : 'bg-white/80 hover:bg-purple-50/80 text-gray-700 border-purple-100/60 hover:border-purple-200 shadow-xs'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-transform group-hover:scale-105 shrink-0 ${
                  isActive
                    ? 'bg-white/20 text-white backdrop-blur-xs'
                    : `${item.badgeColor} border border-white/70 shadow-xs`
                }`}
              >
                <span>{item.emoji}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-gray-900'}`}>
                    {item.label}
                  </span>
                  {item.locked && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 flex items-center gap-0.5 font-medium">
                      🔒 ล็อก
                    </span>
                  )}
                </div>
                <div className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-purple-100' : 'text-gray-500'}`}>
                  {item.sublabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer: ส่วนท้าย (ข้อความเล็ก) */}
      <div className="p-4 border-t border-purple-100/70 bg-gradient-to-b from-purple-50/50 to-pink-50/50 text-center space-y-1">
        <p className="text-[11px] font-semibold text-gray-800 flex items-center justify-center gap-1">
          <span>🌸</span> พัฒนาโดย ครูชมัยพร ถินสำราญ
        </p>
        <p className="text-[10px] text-gray-500 flex items-center justify-center gap-1">
          <span>🏫</span> โรงเรียนท่าบ่อ  สพม.หนองคาย
        </p>
        <p className="text-[10px] text-violet-700 font-semibold flex items-center justify-center gap-1">
          <span>💖</span> ติดตามเพจ AI กับครูพอลล่า
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed Left) */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-72 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10 animate-slide-right">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
