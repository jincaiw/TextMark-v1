#pragma once

#include <KIO/ThumbnailCreator>

class TextMarkThumbnailCreator final : public KIO::ThumbnailCreator
{
public:
    TextMarkThumbnailCreator(QObject *parent, const QVariantList &args);
    KIO::ThumbnailResult create(const KIO::ThumbnailRequest &request) override;
};
