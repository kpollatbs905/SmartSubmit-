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
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#4F46E5',
      customClass: {
        popup: 'rounded-2xl font-[\'Kanit\',sans-serif]',
      },
    });
  },

  error(title: string, text?: string) {
    return Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonText: 'ปิด',
      confirmButtonColor: '#EF4444',
      customClass: {
        popup: 'rounded-2xl font-[\'Kanit\',sans-serif]',
      },
    });
  },

  info(title: string, text?: string) {
    return Swal.fire({
      icon: 'info',
      title,
      text,
      confirmButtonText: 'รับทราบ',
      confirmButtonColor: '#4F46E5',
      customClass: {
        popup: 'rounded-2xl font-[\'Kanit\',sans-serif]',
      },
    });
  },

  loading(title = 'กำลังประมวลผล...', text = 'โปรดรอสักครู่ ระบบกำลังบันทึกข้อมูล') {
    Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
      customClass: {
        popup: 'rounded-2xl font-[\'Kanit\',sans-serif]',
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
      title: 'ต้องการส่งงานต่อไหม?',
      text: 'คุณต้องการส่งงานชิ้นอื่นเพิ่มเติม หรือต้องการดูรายการที่ส่งแล้ว?',
      showCancelButton: true,
      confirmButtonText: 'ส่งงานต่อ',
      cancelButtonText: 'ดูรายการที่ส่งแล้ว',
      confirmButtonColor: '#4F46E5',
      cancelButtonColor: '#10B981',
      reverseButtons: true,
      customClass: {
        popup: 'rounded-2xl font-[\'Kanit\',sans-serif]',
        confirmButton: 'px-5 py-2.5 rounded-xl font-medium',
        cancelButton: 'px-5 py-2.5 rounded-xl font-medium',
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
      title: '🔐 ยืนยันสิทธิ์ผู้ดูแลระบบ (ADMIN)',
      html: `
        <div class="space-y-3 text-left pt-2 font-['Kanit',sans-serif]">
          <p class="text-xs text-gray-500 mb-2">เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเข้าถึงการตั้งค่า Google Sheets และระบบหลังบ้าน</p>
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Username</label>
            <input id="swal-input-username" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="admin" autofocus>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Password</label>
            <input id="swal-input-password" type="password" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="••••••••">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'เข้าสู่ระบบ Admin',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#4F46E5',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-2xl font-[\'Kanit\',sans-serif]',
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
        title: 'เข้าสู่ระบบสำเร็จ',
        text: 'ยินดีต้อนรับสู่ส่วนจัดการระบบ (ADMIN)',
        timer: 1500,
        showConfirmButton: false,
        customClass: {
          popup: 'rounded-2xl font-[\'Kanit\',sans-serif]',
        },
      });
      return true;
    } else {
      await Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'Username หรือ Password ของ ADMIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#EF4444',
        customClass: {
          popup: 'rounded-2xl font-[\'Kanit\',sans-serif]',
        },
      });
      return false;
    }
  },
};
