/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Swal from 'sweetalert2';
import { ADMIN_CONFIG } from '../constants';

export const alertService = {
  success(title: string, text?: string) {
    return Swal.fire({
      icon: 'success',
      title,
      text,
      confirmButtonText: 'ตกลง ✨',
      confirmButtonColor: '#7C3AED',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif] border border-purple-100 shadow-2xl',
        confirmButton: 'rounded-xl px-5 py-2.5 font-bold',
      },
    });
  },

  error(title: string, text?: string) {
    return Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonText: 'ปิด ✕',
      confirmButtonColor: '#F43F5E',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif] border border-rose-100 shadow-2xl',
        confirmButton: 'rounded-xl px-5 py-2.5 font-bold',
      },
    });
  },

  info(title: string, text?: string) {
    return Swal.fire({
      icon: 'info',
      title,
      text,
      confirmButtonText: 'รับทราบ 🌸',
      confirmButtonColor: '#7C3AED',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif] border border-purple-100 shadow-2xl',
        confirmButton: 'rounded-xl px-5 py-2.5 font-bold',
      },
    });
  },

  loading(title = 'กำลังประมวลผล... ✨', text = 'โปรดรอสักครู่ ระบบกำลังบันทึกข้อมูล 🌸') {
    Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif] border border-purple-100 shadow-2xl',
      },
    });
  },

  close() {
    Swal.close();
  },

  /**
   * ถามว่า "ต้องการส่งต่อไหม"
   * ถ้าตอบตกลง -> ส่งต่อ (เลือกวิชา/ครู/งาน)
   * ถ้าตอบไม่ส่ง -> แสดงรายการที่ส่งแล้ว
   */
  async askContinueSubmitting(): Promise<boolean> {
    const result = await Swal.fire({
      icon: 'question',
      title: '🎉 ส่งงานสำเร็จ! ต้องการส่งต่อไหม? 🎒',
      text: 'คุณต้องการส่งงานชิ้นอื่นเพิ่มเติม หรือต้องการไปดูรายการผลงานที่ส่งแล้ว? ✨',
      showCancelButton: true,
      confirmButtonText: '🚀 ส่งงานชิ้นถัดไป',
      cancelButtonText: '🔍 ดูรายการที่ส่งแล้ว',
      confirmButtonColor: '#7C3AED',
      cancelButtonColor: '#10B981',
      reverseButtons: true,
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif] border border-purple-100 shadow-2xl',
        confirmButton: 'px-5 py-2.5 rounded-xl font-bold',
        cancelButton: 'px-5 py-2.5 rounded-xl font-bold',
      },
    });
    return result.isConfirmed;
  },

  /**
   * Popup ตรวจสอบสิทธิ์ Admin:
   * User = admin, Password = polla905
   */
  async promptAdminLogin(): Promise<boolean> {
    const { value: formValues } = await Swal.fire({
      title: '🔐 ยืนยันสิทธิ์ผู้ดูแลระบบ (ADMIN) ✨',
      html: `
        <div class="space-y-3 text-left pt-2 font-['Kanit',sans-serif]">
          <p class="text-xs text-gray-500 mb-2">เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเข้าถึงการตั้งค่า Google Sheets และระบบหลังบ้าน 🌸</p>
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">👤 Username</label>
            <input id="swal-input-username" class="w-full px-3.5 py-2 border border-purple-200 bg-purple-50/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" placeholder="admin" autofocus>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">🔑 Password</label>
            <input id="swal-input-password" type="password" class="w-full px-3.5 py-2 border border-purple-200 bg-purple-50/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" placeholder="••••••••">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'เข้าสู่ระบบ Admin ✨',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#7C3AED',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif] border border-purple-100 shadow-2xl',
        confirmButton: 'px-5 py-2.5 rounded-xl font-bold',
        cancelButton: 'px-5 py-2.5 rounded-xl font-bold',
      },
      preConfirm: () => {
        const usernameInput = document.getElementById('swal-input-username') as HTMLInputElement;
        const passwordInput = document.getElementById('swal-input-password') as HTMLInputElement;
        return {
          username: usernameInput?.value.trim() || '',
          password: passwordInput?.value.trim() || '',
        };
      },
    });

    if (!formValues) {
      return false;
    }

    if (
      formValues.username === ADMIN_CONFIG.username &&
      formValues.password === ADMIN_CONFIG.password
    ) {
      await Swal.fire({
        icon: 'success',
        title: '🎉 เข้าสู่ระบบสำเร็จ',
        text: 'ยินดีต้อนรับสู่ส่วนจัดการระบบ (ADMIN) โรงเรียนท่าบ่อ ✨',
        timer: 1600,
        showConfirmButton: false,
        customClass: {
          popup: 'rounded-3xl font-[\'Kanit\',sans-serif] border border-purple-100 shadow-2xl',
        },
      });
      return true;
    } else {
      await Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'Username หรือ Password ของ ADMIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง ❌',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#F43F5E',
        customClass: {
          popup: 'rounded-3xl font-[\'Kanit\',sans-serif] border border-rose-100 shadow-2xl',
          confirmButton: 'px-5 py-2.5 rounded-xl font-bold',
        },
      });
      return false;
    }
  },
};
