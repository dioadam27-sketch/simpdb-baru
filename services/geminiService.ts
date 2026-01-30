import { GoogleGenAI, Type } from "@google/genai";
import { Course, Lecturer, Room, ScheduleItem, DayOfWeek, TIME_SLOTS } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSmartSchedule = async (
  courses: Course[],
  lecturers: Lecturer[],
  rooms: Room[]
): Promise<ScheduleItem[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key missing");
  }

  // Generate class list PDB01-PDB125 for AI context
  const classes = Array.from({ length: 125 }, (_, i) => {
    const num = i + 1;
    return `PDB${num < 10 ? '0' + num : num}`;
  });

  const dataContext = JSON.stringify({
    courses: courses.map(c => ({ id: c.id, name: c.name, credits: c.credits })),
    lecturers: lecturers.map(l => ({ id: l.id, name: l.name })),
    rooms: rooms.map(r => ({ id: r.id, name: r.name })),
    classes: classes,
    availableDays: Object.values(DayOfWeek),
    availableTimes: TIME_SLOTS
  });

  const prompt = `
    Bertindaklah sebagai sistem penjadwalan universitas yang cerdas.
    Tugasmu adalah membuat jadwal kuliah yang valid dan optimal berdasarkan data berikut:
    ${dataContext}

    ATURAN:
    1. Setiap mata kuliah (course) harus dijadwalkan.
    2. Satu Kelas (PDBxx) tidak boleh dijadwalkan di dua tempat pada waktu yang sama.
    3. Jangan menjadwalkan dosen yang sama di dua tempat berbeda pada waktu yang sama.
    4. Jangan menjadwalkan ruangan yang sama untuk dua kelas berbeda pada waktu yang sama.
    5. Kembalikan data dalam format JSON murni array of ScheduleItem.
    6. Gunakan ID yang valid dari data yang diberikan.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              courseId: { type: Type.STRING },
              lecturerId: { type: Type.STRING },
              roomId: { type: Type.STRING },
              className: { type: Type.STRING },
              day: { type: Type.STRING },
              timeSlot: { type: Type.STRING }
            },
            required: ["id", "courseId", "lecturerId", "roomId", "className", "day", "timeSlot"]
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) return [];

    const scheduleItems = JSON.parse(resultText) as ScheduleItem[];
    return scheduleItems;

  } catch (error) {
    console.error("Gemini Scheduling Error:", error);
    throw new Error("Gagal membuat jadwal otomatis.");
  }
};