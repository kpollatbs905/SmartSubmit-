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
      sublabel: 'ค้นหาคะแนน & เช็คงานค้างส่ง 🎯',
      icon: Search,
      badgeColor: 'bg-emerald-100 text-emerald-700',
    },
    {
      id: 'teacher' as ActiveTab,
      label: '3. หน้าสำหรับครูผู้สอน',
      emoji: '👩‍🏫',
      sublabel: 'ตรวจงาน • แดชบอร์ด • รายงาน 📊',
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
    <div className="flex flex-col h-full bg-gradient-to-b from-yellow-200 via-amber-200 to-yellow-300 backdrop-blur-md border-r border-amber-400/80 shadow-2xl shadow-amber-950/20">
      {/* App Branding Header */}
      <div className="p-5 border-b border-amber-400/80 flex items-center justify-between bg-gradient-to-r from-amber-300/90 via-yellow-300/90 to-amber-400/90 backdrop-blur-xs shadow-xs">
        <div className="flex items-center gap-3">
          <img 
            src="https://img1.pic.in.th/images/images-39bd26cc1ba9520da.png" 
            alt="โลโก้โรงเรียนท่าบ่อ" 
            className="w-13 h-13 object-contain rounded-2xl drop-shadow-md shrink-0 bg-white/60 p-1 border border-amber-300"
          />
          <div>
            <h1 className="text-lg font-black text-amber-950 leading-tight tracking-tight">
              โรงเรียนท่าบ่อ
            </h1>
            <div className="text-xs font-bold text-amber-900/85">
              สพม.หนองคาย
            </div>
            <p className="text-[11px] font-medium text-amber-950 leading-tight mt-0.5">
              ระบบตรวจงานให้คะแนน ออนไลน์
            </p>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden p-2 text-amber-950 hover:text-black rounded-lg hover:bg-amber-300/80 cursor-pointer transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation Menu List */}
      <div className="p-4 flex-1 space-y-2.5 overflow-y-auto bg-gradient-to-b from-yellow-100/60 via-amber-100/40 to-yellow-200/50">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-[10px] font-extrabold text-amber-950 uppercase tracking-widest flex items-center gap-1">
            🌟 เมนูหลักของระบบ
          </span>
          <span className="text-[10px] bg-amber-400/90 text-amber-950 font-bold px-2 py-0.5 rounded-full border border-amber-500/50 shadow-xs">
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
                  ? 'bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-700 text-white border-amber-500 shadow-lg shadow-amber-900/30 ring-2 ring-amber-400/50'
                  : 'bg-white/95 hover:bg-white text-gray-900 border-amber-300/80 hover:border-amber-500 shadow-sm hover:shadow-md'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-transform group-hover:scale-105 shrink-0 ${
                  isActive
                    ? 'bg-white/25 text-white backdrop-blur-xs'
                    : `${item.badgeColor} border border-amber-200/60 shadow-xs`
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
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-300 text-amber-950 flex items-center gap-0.5 font-bold border border-amber-400">
                      🔒 ล็อก
                    </span>
                  )}
                </div>
                <div className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-amber-100' : 'text-gray-600'}`}>
                  {item.sublabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer: ส่วนท้าย (ข้อความเล็ก) */}
      <div className="p-4 border-t border-amber-400/80 bg-gradient-to-b from-amber-200 via-yellow-300 to-amber-300 text-center space-y-1 shadow-inner">
        <p className="text-[11px] font-bold text-amber-950 flex items-center justify-center gap-1">
          <span>🌸</span> พัฒนาโดย ครูชมัยพร ถินสำราญ
        </p>
        <p className="text-[10px] text-amber-900 font-medium flex items-center justify-center gap-1">
          <span>🏫</span> โรงเรียนท่าบ่อ  สพม.หนองคาย
        </p>
        <p className="text-[10px] text-amber-950 font-bold flex items-center justify-center gap-1">
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
            className="fixed inset-0 bg-[#071330]/70 backdrop-blur-sm"
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
