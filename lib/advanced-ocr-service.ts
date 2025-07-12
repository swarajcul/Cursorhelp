import Tesseract from "tesseract.js"

export interface AdvancedOCRResult {
  text: string
  confidence: number
  words: Array<{
    text: string
    confidence: number
    bbox: { x0: number; y0: number; x1: number; y1: number }
  }>
}

export interface GamePerformanceData {
  playerName?: string
  kills: number
  assists: number
  damage: number
  survivalTime: number
  placement?: number
}

export class AdvancedOCRService {
  private static readonly TESSERACT_OPTIONS = {
    logger: (m: any) => {
      if (m.status === "recognizing text") {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`)
      }
    },
    tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,:-",
    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
  }

  static async extractAdvancedText(imageFile: File): Promise<AdvancedOCRResult> {
    try {
      // Preprocess image for better OCR results
      const processedImage = await this.preprocessImage(imageFile)

      const result = await Tesseract.recognize(processedImage, "eng", this.TESSERACT_OPTIONS)

      return {
        text: result.data.text,
        confidence: result.data.confidence,
        words: result.data.words.map((word) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox,
        })),
      }
    } catch (error) {
      console.error("Advanced OCR extraction failed:", error)
      throw new Error("Failed to extract text from image")
    }
  }

  private static async preprocessImage(file: File): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")

        if (!ctx) {
          reject(new Error("Could not get canvas context"))
          return
        }

        // Set canvas size
        canvas.width = img.width
        canvas.height = img.height

        // Draw original image
        ctx.drawImage(img, 0, 0)

        // Apply image enhancements for better OCR
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        // Increase contrast and brightness
        for (let i = 0; i < data.length; i += 4) {
          // Increase contrast
          data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.5 + 128)) // Red
          data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * 1.5 + 128)) // Green
          data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * 1.5 + 128)) // Blue
        }

        ctx.putImageData(imageData, 0, 0)
        resolve(canvas)
      }

      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = URL.createObjectURL(file)
    })
  }

  static parseGamePerformanceData(ocrResult: AdvancedOCRResult): GamePerformanceData[] {
    const { text, words } = ocrResult
    const lines = text.split("\n").filter((line) => line.trim().length > 0)
    const performances: GamePerformanceData[] = []

    // Enhanced parsing patterns for different game formats
    const patterns = {
      // Valorant/CS style: "PlayerName 15 5 2500 8.5"
      valorantStyle: /(\w+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+\.?\d*)/g,

      // PUBG/BR style: "PlayerName #3 15K 5A 2500D 8.5m"
      battleRoyaleStyle: /(\w+)\s*#?(\d+)?\s*(\d+)[Kk]?\s*(\d+)[Aa]?\s*(\d+)[Dd]?\s*(\d+\.?\d*)[Mm]?/g,

      // Table format: numbers in columns
      tableFormat: /(\d+)\s+(\d+)\s+(\d+)\s+(\d+\.?\d*)/g,

      // Apex Legends style: "PlayerName | 15 | 5 | 2500 | 8:30"
      apexStyle: /(\w+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+):?(\d+)/g,
    }

    // Try different parsing strategies
    let matches: RegExpMatchArray[] = []

    // Strategy 1: Try Valorant style
    matches = Array.from(text.matchAll(patterns.valorantStyle))
    if (matches.length > 0) {
      matches.forEach((match) => {
        performances.push({
          playerName: match[1],
          kills: Number.parseInt(match[2]),
          assists: Number.parseInt(match[3]),
          damage: Number.parseInt(match[4]),
          survivalTime: Number.parseFloat(match[5]),
        })
      })
    }

    // Strategy 2: Try Battle Royale style if no matches
    if (performances.length === 0) {
      matches = Array.from(text.matchAll(patterns.battleRoyaleStyle))
      matches.forEach((match) => {
        performances.push({
          playerName: match[1],
          placement: match[2] ? Number.parseInt(match[2]) : undefined,
          kills: Number.parseInt(match[3]),
          assists: Number.parseInt(match[4]),
          damage: Number.parseInt(match[5]),
          survivalTime: Number.parseFloat(match[6]),
        })
      })
    }

    // Strategy 3: Try table format if still no matches
    if (performances.length === 0) {
      matches = Array.from(text.matchAll(patterns.tableFormat))
      matches.forEach((match, index) => {
        performances.push({
          playerName: `Player ${index + 1}`,
          kills: Number.parseInt(match[1]),
          assists: Number.parseInt(match[2]),
          damage: Number.parseInt(match[3]),
          survivalTime: Number.parseFloat(match[4]),
        })
      })
    }

    // Strategy 4: Use word positions for more accurate extraction
    if (performances.length === 0) {
      performances.push(...this.parseByWordPositions(words))
    }

    // Ensure we have at least 4 entries for team games
    while (performances.length < 4) {
      performances.push({
        kills: 0,
        assists: 0,
        damage: 0,
        survivalTime: 0,
      })
    }

    return performances.slice(0, 4)
  }

  private static parseByWordPositions(words: AdvancedOCRResult["words"]): GamePerformanceData[] {
    const performances: GamePerformanceData[] = []

    // Group words by approximate Y position (rows)
    const rows: { [key: number]: typeof words } = {}
    const tolerance = 20 // pixels

    words.forEach((word) => {
      const y = Math.round(word.bbox.y0 / tolerance) * tolerance
      if (!rows[y]) rows[y] = []
      rows[y].push(word)
    })

    // Sort rows by Y position
    const sortedRows = Object.keys(rows)
      .map((y) => Number.parseInt(y))
      .sort((a, b) => a - b)
      .map((y) => rows[y])

    // Extract data from each row
    sortedRows.forEach((row) => {
      const numbers = row
        .filter((word) => /^\d+\.?\d*$/.test(word.text))
        .map((word) => Number.parseFloat(word.text))
        .sort((a, b) => a - b) // Sort by value to identify kills, assists, damage

      if (numbers.length >= 3) {
        // Assume: smallest = kills, second = assists, largest = damage, last = survival
        performances.push({
          kills: Math.round(numbers[0]) || 0,
          assists: Math.round(numbers[1]) || 0,
          damage: Math.round(numbers[numbers.length - 2]) || 0,
          survivalTime: numbers[numbers.length - 1] || 0,
        })
      }
    })

    return performances
  }

  static async processGameScreenshot(
    imageFile: File,
    onProgress?: (progress: number) => void,
  ): Promise<GamePerformanceData[]> {
    try {
      // Update progress
      onProgress?.(10)

      const ocrResult = await this.extractAdvancedText(imageFile)
      onProgress?.(70)

      if (ocrResult.confidence < 50) {
        throw new Error(
          `OCR confidence too low (${Math.round(ocrResult.confidence)}%). Please try a clearer screenshot.`,
        )
      }

      const performances = this.parseGamePerformanceData(ocrResult)
      onProgress?.(100)

      return performances
    } catch (error) {
      onProgress?.(0)
      throw error
    }
  }
}
