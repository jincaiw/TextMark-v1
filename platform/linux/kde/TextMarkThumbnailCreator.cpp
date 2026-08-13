#include "TextMarkThumbnailCreator.h"

#include <QFileInfo>
#include <QDir>
#include <QImage>
#include <QProcess>
#include <QStandardPaths>
#include <QTemporaryFile>

#include <algorithm>

namespace {
constexpr qint64 kMaximumSourceBytes = 32 * 1024 * 1024;
constexpr int kThumbnailTimeoutMs = 10'000;
}

TextMarkThumbnailCreator::TextMarkThumbnailCreator(QObject *parent, const QVariantList &args)
    : KIO::ThumbnailCreator(parent, args)
{
}

KIO::ThumbnailResult TextMarkThumbnailCreator::create(const KIO::ThumbnailRequest &request)
{
    if (!request.url().isLocalFile()) {
        return KIO::ThumbnailResult::fail();
    }
    const QFileInfo source(request.url().toLocalFile());
    if (!source.isFile() || source.size() < 0 || source.size() > kMaximumSourceBytes) {
        return KIO::ThumbnailResult::fail();
    }

    QTemporaryFile output(QDir::tempPath() + QStringLiteral("/textmark-kde-thumbnail-XXXXXX.png"));
    if (!output.open()) {
        return KIO::ThumbnailResult::fail();
    }
    const QString outputPath = output.fileName();
    output.close();

    QString executable = qEnvironmentVariable("TEXTMARK_THUMBNAIL_EXECUTABLE");
    if (executable.isEmpty()) {
        executable = QStandardPaths::findExecutable(QStringLiteral("textmark"));
    }
    if (executable.isEmpty()) {
        return KIO::ThumbnailResult::fail();
    }

    const int requestedSize = std::clamp(std::max(request.targetSize().width(), request.targetSize().height()), 128, 1024);
    QProcess process;
    process.setProgram(executable);
    process.setArguments({QStringLiteral("--thumbnail"), source.canonicalFilePath(), outputPath, QString::number(requestedSize)});
    process.setProcessChannelMode(QProcess::ForwardedErrorChannel);
    process.start();
    if (!process.waitForStarted(1'000) || !process.waitForFinished(kThumbnailTimeoutMs) || process.exitStatus() != QProcess::NormalExit || process.exitCode() != 0) {
        process.kill();
        process.waitForFinished();
        return KIO::ThumbnailResult::fail();
    }

    QImage image(outputPath);
    if (image.isNull()) {
        return KIO::ThumbnailResult::fail();
    }
    image = image.scaled(request.targetSize(), Qt::KeepAspectRatio, Qt::SmoothTransformation);
    image.setDevicePixelRatio(request.devicePixelRatio());
    return KIO::ThumbnailResult::pass(image);
}
