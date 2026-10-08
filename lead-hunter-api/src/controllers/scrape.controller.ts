import { Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';

export const triggerManualScrape = (req: Request, res: Response) => {
    const pythonExecutable = path.join(process.cwd(), 'venv', 'bin', 'python');
    const { queries, mode = 'keyword', platform = 'X' } = req.body;

    // Validate mode
    const validModes = ['keyword', 'trigger', 'authority'];
    const scrapeMode = validModes.includes(mode) ? mode : 'keyword';

    let args: string[] = [];
    if (platform === 'LinkedIn') {
        const scriptPath = path.join(process.cwd(), 'linkedin_worker.py');
        args = [scriptPath];
    } else if (platform === 'Reddit') {
        const scriptPath = path.join(process.cwd(), 'reddit_worker.py');
        args = [scriptPath];
    } else {
        const scriptPath = path.join(process.cwd(), 'x_worker.py');
        args = [scriptPath, '--mode', scrapeMode];
    }

    if (Array.isArray(queries) && queries.length > 0) {
        const cleanedQueries = queries
            .filter((q: unknown) => typeof q === 'string' && q.trim())
            .map((q: string) => q.trim());

        if (cleanedQueries.length > 0) {
            args.push(...cleanedQueries);
            console.log(`🚀 Manual scrape triggered on ${platform} with ${cleanedQueries.length} queries: ${cleanedQueries}`);
        } else {
            console.log(`🚀 Manual scrape triggered on ${platform} using database keywords...`);
        }
    } else {
        console.log(`🚀 Manual scrape triggered on ${platform} using database keywords...`);
    }

    // Use spawn instead of exec for better performance with long-running processes
    const child = spawn(pythonExecutable, args, {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
    });

    child.stdout.on('data', (data: Buffer) => {
        console.log(`✅ Scraper: ${data.toString().trim()}`);
    });

    child.stderr.on('data', (data: Buffer) => {
        console.error(`⚠️ Scraper: ${data.toString().trim()}`);
    });

    child.on('error', (err: Error) => {
        console.error(`❌ Failed to start scraper: ${err.message}`);
    });

    child.on('close', (code: number | null) => {
        console.log(`📦 Scraper process exited with code ${code}`);
    });

    // Immediately respond so the UI doesn't freeze
    res.status(202).json({
        success: true,
        message: "Scraper deployed. Hunting targets in the background.",
    });
};
