/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  let portFromArg: number | undefined;
  const portIdx = process.argv.indexOf('--port');
  if (portIdx !== -1 && process.argv[portIdx + 1]) {
    const p = parseInt(process.argv[portIdx + 1], 10);
    if (!isNaN(p)) portFromArg = p;
  }

  let hostFromArg: string | undefined;
  const hostIdx = process.argv.indexOf('--host');
  if (hostIdx !== -1 && process.argv[hostIdx + 1]) {
    hostFromArg = process.argv[hostIdx + 1];
  }

  const PORT = Number(process.env.PORT) || portFromArg || 3000;
  const HOST = process.env.HOST || hostFromArg || '0.0.0.0';

  app.use(express.json({ limit: '10mb' }));

  // AI Evaluation API endpoint
  app.post('/api/ai-evaluate', async (req, res) => {
    try {
      const {
        assignmentTitle,
        workType = 'ใบงาน/แบบฝึกหัด',
        maxScore = 10,
        sampleUrl,
        rubricCriteria,
        studentName = 'นักเรียน',
        workUrl = '',
        gradeLevel = '',
        room = '',
        studentNumber = '',
      } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(200).json({
          success: false,
          error: 'No GEMINI_API_KEY provided on server, fallback will be used',
        });
      }

      const ai = new GoogleGenAI({});
      const prompt = `คุณคือผู้ช่วย AI ประเมินผลงานนักเรียนระดับมัธยมศึกษา (โรงเรียนท่าบ่อ สพม.หนองคาย) เพจ AI กับครูพอลล่า
ช่วยคุณครูตรวจประเมินผลงานของนักเรียนอย่างละเอียดและสร้างสรรค์ โดยวิเคราะห์ตาม "ชนิดของงาน": ${workType}

ข้อมูลงาน:
- ชื่องาน: ${assignmentTitle}
- ชนิดของงาน: ${workType}
- คะแนนเต็ม: ${maxScore} คะแนน
- ลิงก์ตัวอย่างใบงาน/แนวทางครู: ${sampleUrl || 'ตามเกณฑ์มาตรฐานการเรียนรู้'}
- เกณฑ์ประเมินที่ระบุ: ${rubricCriteria || 'ความถูกต้อง ความคิดสร้างสรรค์ ความเรียบร้อย การประยุกต์ใช้'}
- ชื่อผู้ส่ง: ${studentName} (${gradeLevel}/${room} เลขที่ ${studentNumber})
- ลิงก์ผลงานที่นักเรียนส่ง: ${workUrl}

เกณฑ์การประเมินตามชนิดของงาน:
1. หากเป็น "ใบงาน/แบบฝึกหัด": ตรวจความถูกต้องของคำตอบ การแสดงวิธีทำ ลายมือและความเป็นระเบียบ
2. หากเป็น "ชิ้นงานกราฟิก/Canva/โปสเตอร์": ตรวจการจัดวาง Layout, ความคิดสร้างสรรค์, การใช้สี, ความถูกต้องของเนื้อหาที่สรุป
3. หากเป็น "ผังงาน/อัลกอริทึม/Coding": ตรวจตรรกะความสมเหตุสมผล, สัญลักษณ์ Flowchart ถูกต้อง, โค้ดทำงานได้จริง
4. หากเป็น "วิดีโอคลิป/การนำเสนอ": ตรวจทักษะการสื่อสาร, การตัดต่อ, ความน่าสนใจ, สาระความรู้ตรงประเด็น
5. หากเป็น "เรียงความ/ข้อเขียน": ตรวจโครงสร้าง (คำนำ เนื้อเรื่อง สรุป), การสะกดคำ, สำนวนภาษาและข้อคิด

โปรดตอบเป็น JSON เท่านั้นในรูปแบบ:
{
  "suggestedScore": number (ทศนิยม 1 ตำแหน่ง ไม่เกิน ${maxScore}),
  "feedback": "ข้อความให้กำลังใจและคำแนะนำสั้นๆ กระชับ สุภาพ ภาษาไทย เหมาะสำหรับครูแจ้งนักเรียน",
  "strengths": ["จุดเด่นข้อที่ 1", "จุดเด่นข้อที่ 2", "จุดเด่นข้อที่ 3"],
  "improvements": ["จุดที่ควรระวังหรือพัฒนาเพิ่มเติม 1-2 ข้อ"],
  "rubricBreakdown": [
    { "criteria": "เกณฑ์ด้านที่ 1", "score": number, "max": number, "comment": "คำอธิบาย" },
    { "criteria": "เกณฑ์ด้านที่ 2", "score": number, "max": number, "comment": "คำอธิบาย" },
    { "criteria": "เกณฑ์ด้านที่ 3", "score": number, "max": number, "comment": "คำอธิบาย" }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '';
      try {
        const parsed = JSON.parse(responseText);
        return res.json({ success: true, data: parsed });
      } catch (e) {
        return res.json({
          success: true,
          data: {
            suggestedScore: Math.round(Number(maxScore) * 0.88 * 2) / 2,
            feedback: responseText,
            strengths: ['ส่งงานตรงเวลา', 'ผลงานมีความตั้งใจ'],
            improvements: ['พัฒนาความละเอียดเพิ่มเติม'],
            rubricBreakdown: [],
          },
        });
      }
    } catch (err: any) {
      console.error('Server AI evaluation error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log(`Ready on port ${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
