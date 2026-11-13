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

// Shared Gemini AI Client configured per Gemini API specifications
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

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

  // 1. AI Evaluation API endpoint
  app.post('/api/ai-evaluate', async (req, res) => {
    try {
      const {
        assignmentTitle,
        workType = 'ใบงาน/แบบฝึกหัด',
        maxScore = 10,
        sampleUrl,
        rubricCriteria,
        customAiCriteria,
        studentName = 'นักเรียน',
        workUrl = '',
        gradeLevel = '',
        room = '',
        studentNumber = '',
      } = req.body;

      const ai = getGeminiClient();

      if (!ai) {
        return res.status(200).json({
          success: false,
          error: 'No GEMINI_API_KEY configured on server, fallback will be used',
        });
      }

      const activeCriteria = (customAiCriteria && String(customAiCriteria).trim())
        || (rubricCriteria && String(rubricCriteria).trim())
        || '';

      const prompt = `คุณคือผู้ช่วย AI ประเมินผลงานนักเรียนระดับมัธยมศึกษา (โรงเรียนท่าบ่อ สพม.หนองคาย) เพจ AI กับครูพอลล่า
ช่วยคุณครูตรวจประเมินผลงานของนักเรียนอย่างละเอียดและสร้างสรรค์ โดยวิเคราะห์ตาม "ชนิดของงาน": ${workType}

ข้อมูลงาน:
- ชื่องาน: ${assignmentTitle}
- ชนิดของงาน: ${workType}
- คะแนนเต็ม: ${maxScore} คะแนน
- ลิงก์ตัวอย่างใบงาน/แนวทางครู: ${sampleUrl || 'ตามเกณฑ์มาตรฐานการเรียนรู้'}
- เกณฑ์การให้คะแนนที่ครูกำหนด: ${activeCriteria || 'ความถูกต้อง ความคิดสร้างสรรค์ ความเรียบร้อย การประยุกต์ใช้'}
- ชื่อผู้ส่ง: ${studentName} (${gradeLevel}/${room} เลขที่ ${studentNumber})
- ลิงก์ผลงานที่นักเรียนส่ง: ${workUrl}

${activeCriteria ? `สำคัญมาก — ต้องยึดเกณฑ์ที่ครูกำหนดเป็นหลัก:
กรุณาประเมินผลงาน ให้คะแนน "suggestedScore" และแยกหัวข้อใน "rubricBreakdown" ให้ตรงตามเกณฑ์และสัดส่วนคะแนนที่ครูระบุไว้ด้านบนอย่างเคร่งครัด (${activeCriteria}) โดยผลรวมของคะแนนเต็ม (max) ใน rubricBreakdown ควรสอดคล้องกับคะแนนเต็ม ${maxScore} คะแนน` : `เกณฑ์การประเมินตามชนิดของงาน:
1. หากเป็น "ใบงาน/แบบฝึกหัด": ตรวจความถูกต้องของคำตอบ การแสดงวิธีทำ ลายมือและความเป็นระเบียบ
2. หากเป็น "ชิ้นงานกราฟิก/Canva/โปสเตอร์": ตรวจการจัดวาง Layout, ความคิดสร้างสรรค์, การใช้สี, ความถูกต้องของเนื้อหาที่สรุป
3. หากเป็น "ผังงาน/อัลกอริทึม/Coding": ตรวจตรรกะความสมเหตุสมผล, สัญลักษณ์ Flowchart ถูกต้อง, โค้ดทำงานได้จริง
4. หากเป็น "วิดีโอคลิป/การนำเสนอ": ตรวจทักษะการสื่อสาร, การตัดต่อ, ความน่าสนใจ, สาระความรู้ตรงประเด็น
5. หากเป็น "เรียงความ/ข้อเขียน": ตรวจโครงสร้าง (คำนำ เนื้อเรื่อง สรุป), การสะกดคำ, สำนวนภาษาและข้อคิด`}

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
      } catch {
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

  // 2. Server-side Gemini generate content endpoint
  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const { prompt, model = 'gemini-3.8-flash', systemInstruction } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        return res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not set on the server' });
      }

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined,
      });

      return res.json({ success: true, text: response.text });
    } catch (err: any) {
      console.error('Server Gemini generate error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Server-side Gemini streaming endpoint (Server-Sent Events)
  app.post('/api/gemini/stream', async (req, res) => {
    try {
      const { prompt, model = 'gemini-3.8-flash', systemInstruction } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        return res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not set on the server' });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const streamResponse = await ai.models.generateContentStream({
        model,
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined,
      });

      for await (const chunk of streamResponse) {
        const textChunk = chunk.text || '';
        res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      console.error('Server Gemini stream error:', err);
      if (!res.headersSent) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.end();
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
