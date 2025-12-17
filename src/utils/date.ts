export const formatTime = (timestamp: number, useUTC: boolean): string => {
    const date = new Date(timestamp);

    if (useUTC) {
        // HH:mm UTC
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes} UTC`;
    } else {
        // HH:mm LocalCode (e.g., EST, PDT)
        // Intl.DateTimeFormat is good for this
        const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        // Attempt to get timezone code (e.g. EST)
        // Fallback to "Loc" if not available
        let tzCode = 'Loc';
        try {
            const str = date.toLocaleTimeString('en-us', { timeZoneName: 'short' });
            const parts = str.split(' ');
            tzCode = parts[parts.length - 1];
        } catch (e) { }

        return `${timePart} ${tzCode}`;
    }
}
